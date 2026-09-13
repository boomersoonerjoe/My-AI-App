#!/usr/bin/env python3
"""Generate an Xcode project with version-pinned direct dependencies."""
import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
objects = {}
def uid(label): return hashlib.sha256(label.encode()).hexdigest()[:24].upper()
def add(label, isa, **fields):
    key = uid(label)
    objects[key] = dict(isa=isa, **fields)
    return key

def config_list(label, common):
    configs = []
    for name in ['Debug', 'Release']:
        settings = dict(common)
        settings['SWIFT_OPTIMIZATION_LEVEL'] = '-Onone' if name == 'Debug' else '-O'
        if name == 'Debug':
            settings['ENABLE_TESTABILITY'] = 'YES'
            settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = 'DEBUG'
        configs.append(add(label+name, 'XCBuildConfiguration', name=name, buildSettings=settings))
    return add(label+'configs', 'XCConfigurationList', buildConfigurations=configs, defaultConfigurationIsVisible=0, defaultConfigurationName='Release')

def sources(label, directory):
    refs, builds = [], []
    for path in sorted((ROOT/directory).glob('*.swift')):
        ref = add(str(path.relative_to(ROOT)), 'PBXFileReference', lastKnownFileType='sourcecode.swift', path=path.name, sourceTree='<group>')
        refs.append(ref)
        builds.append(add('build'+str(path.relative_to(ROOT)), 'PBXBuildFile', fileRef=ref))
    group = add(label+'group', 'PBXGroup', children=refs, path=directory, sourceTree='<group>')
    phase = add(label+'sources', 'PBXSourcesBuildPhase', buildActionMask=2147483647, files=builds, runOnlyForDeploymentPostprocessing=0)
    return group, phase

app_group, app_sources = sources('app', 'PocketAI')
test_group, test_sources = sources('test', 'PocketAITests')
app_product = add('app-product','PBXFileReference', explicitFileType='wrapper.application', includeInIndex=0, path='PocketAI.app', sourceTree='BUILT_PRODUCTS_DIR')
test_product = add('test-product','PBXFileReference', explicitFileType='wrapper.cfbundle', includeInIndex=0, path='PocketAITests.xctest', sourceTree='BUILT_PRODUCTS_DIR')
products = add('products','PBXGroup',children=[app_product,test_product],name='Products',sourceTree='<group>')
main = add('main','PBXGroup',children=[app_group,test_group,products],sourceTree='<group>')
common = {'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'26.0','SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','CODE_SIGN_STYLE':'Automatic','TARGETED_DEVICE_FAMILY':'1','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','SUPPORTS_MACCATALYST':'NO'}
project_configs = config_list('project',common)
app_configs = config_list('app',{'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'com.example.PocketAI','GENERATE_INFOPLIST_FILE':'YES','INFOPLIST_KEY_CFBundleDisplayName':'Pocket AI','INFOPLIST_KEY_UILaunchScreen_Generation':'YES','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES','INFOPLIST_KEY_UISupportedInterfaceOrientations':'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight','MARKETING_VERSION':'0.3.0','CURRENT_PROJECT_VERSION':'3','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks'})
test_configs = config_list('test',{'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'com.example.PocketAI.Tests','GENERATE_INFOPLIST_FILE':'YES','TEST_HOST':'$(BUILT_PRODUCTS_DIR)/PocketAI.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/PocketAI','BUNDLE_LOADER':'$(TEST_HOST)','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'})
def phase(label, kind): return add(label,kind,buildActionMask=2147483647,files=[],runOnlyForDeploymentPostprocessing=0)
app = add('app-target','PBXNativeTarget',buildConfigurationList=app_configs,buildPhases=[app_sources,phase('app-frameworks','PBXFrameworksBuildPhase'),phase('app-resources','PBXResourcesBuildPhase')],buildRules=[],dependencies=[],name='PocketAI',productName='PocketAI',productReference=app_product,productType='com.apple.product-type.application')
proxy = add('proxy','PBXContainerItemProxy',containerPortal=uid('project'),proxyType=1,remoteGlobalIDString=app,remoteInfo='PocketAI')
dep = add('test-dependency','PBXTargetDependency',target=app,targetProxy=proxy)
test = add('test-target','PBXNativeTarget',buildConfigurationList=test_configs,buildPhases=[test_sources,phase('test-frameworks','PBXFrameworksBuildPhase'),phase('test-resources','PBXResourcesBuildPhase')],buildRules=[],dependencies=[dep],name='PocketAITests',productName='PocketAITests',productReference=test_product,productType='com.apple.product-type.bundle.unit-test')
# Pin APIs to the versions reviewed for this source checkpoint.
mlx = add('mlx-package', 'XCRemoteSwiftPackageReference', repositoryURL='https://github.com/ml-explore/mlx-swift-lm', requirement={'kind':'exactVersion','version':'3.31.3'})
tokenizers = add('tokenizer-package', 'XCRemoteSwiftPackageReference', repositoryURL='https://github.com/huggingface/swift-transformers', requirement={'kind':'exactVersion','version':'1.3.0'})
package_products = []
for name, package in [('MLXLLM',mlx),('MLXLMCommon',mlx),('MLXHuggingFace',mlx),('Tokenizers',tokenizers)]:
    product = add('package-product-'+name, 'XCSwiftPackageProductDependency', package=package, productName=name)
    package_products.append(product)
    objects[uid('app-frameworks')]['files'].append(add('link-'+name, 'PBXBuildFile', productRef=product))
objects[app]['packageProductDependencies'] = package_products
project = add('project','PBXProject',attributes={'LastUpgradeCheck':'2700','TargetAttributes':{app:{'CreatedOnToolsVersion':'27.0'},test:{'CreatedOnToolsVersion':'27.0','TestTargetID':app}}},buildConfigurationList=project_configs,compatibilityVersion='Xcode 14.0',developmentRegion='en',hasScannedForEncodings=0,knownRegions=['en','Base'],mainGroup=main,productRefGroup=products,projectDirPath='',projectRoot='',targets=[app,test],packageReferences=[mlx,tokenizers])

def emit(value, level=0):
    if isinstance(value, dict):
        return '{\n'+''.join('\t'*(level+1)+json.dumps(str(k))+' = '+emit(v,level+1)+';\n' for k,v in value.items())+'\t'*level+'}'
    if isinstance(value, list): return '('+', '.join(emit(v,level) for v in value)+')'
    if isinstance(value,int): return str(value)
    return json.dumps(value)

proj=ROOT/'PocketAI.xcodeproj'
proj.mkdir(exist_ok=True)
(proj/'project.pbxproj').write_text('// !$*UTF8*$!\n'+emit({'archiveVersion':1,'classes':{},'objectVersion':56,'objects':objects,'rootObject':project})+'\n')
# Also validate the generated graph before it leaves this script.
assert len(objects)==len(set(objects))
assert objects[project]['targets']==[app,test]
for key,obj in objects.items():
    for field in ['fileRef','productReference','buildConfigurationList','containerPortal','target','targetProxy','mainGroup','productRefGroup','productRef','package']:
        if field in obj: assert obj[field] in objects, (key,field)
    for field in ['children','buildPhases','dependencies','buildConfigurations','targets','files','packageReferences','packageProductDependencies']:
        for ref in obj.get(field,[]): assert ref in objects, (key,field,ref)

scheme = ET.Element('Scheme',LastUpgradeVersion='2700',version='1.3')
build = ET.SubElement(scheme,'BuildAction',parallelizeBuildables='YES',buildImplicitDependencies='YES')
entries=ET.SubElement(build,'BuildActionEntries')
def reference(parent, identifier, name):
    ET.SubElement(parent,'BuildableReference',BuildableIdentifier='primary',BlueprintIdentifier=identifier,BuildableName=name+('.app' if name=='PocketAI' else '.xctest'),BlueprintName=name,ReferencedContainer='container:PocketAI.xcodeproj')
entry=ET.SubElement(entries,'BuildActionEntry',buildForTesting='YES',buildForRunning='YES',buildForProfiling='YES',buildForArchiving='YES',buildForAnalyzing='YES')
reference(entry,app,'PocketAI')
test_action=ET.SubElement(scheme,'TestAction',buildConfiguration='Debug',selectedDebuggerIdentifier='Xcode.DebuggerFoundation.Debugger.LLDB',selectedLauncherIdentifier='Xcode.IDEFoundation.Launcher.LLDB',shouldUseLaunchSchemeArgsEnv='YES')
reference(ET.SubElement(ET.SubElement(test_action,'Testables'),'TestableReference',skipped='NO'),test,'PocketAITests')
launch=ET.SubElement(scheme,'LaunchAction',buildConfiguration='Debug',selectedDebuggerIdentifier='Xcode.DebuggerFoundation.Debugger.LLDB',selectedLauncherIdentifier='Xcode.IDEFoundation.Launcher.LLDB',launchStyle='0',useCustomWorkingDirectory='NO',ignoresPersistentStateOnLaunch='NO',debugDocumentVersioning='YES',debugServiceExtension='internal',allowLocationSimulation='YES')
reference(ET.SubElement(launch,'BuildableProductRunnable',runnableDebuggingMode='0'),app,'PocketAI')
profile=ET.SubElement(scheme,'ProfileAction',buildConfiguration='Release',shouldUseLaunchSchemeArgsEnv='YES',savedToolIdentifier='',useCustomWorkingDirectory='NO',debugDocumentVersioning='YES')
reference(ET.SubElement(profile,'BuildableProductRunnable',runnableDebuggingMode='0'),app,'PocketAI')
ET.SubElement(scheme,'AnalyzeAction',buildConfiguration='Debug')
ET.SubElement(scheme,'ArchiveAction',buildConfiguration='Release',revealArchiveInOrganizer='YES')
scheme_path=proj/'xcshareddata/xcschemes/PocketAI.xcscheme'
scheme_path.parent.mkdir(parents=True,exist_ok=True)
ET.indent(scheme)
ET.ElementTree(scheme).write(scheme_path,encoding='UTF-8',xml_declaration=True)
print(f'Generated {len(objects)} project objects; references validated. Scheme created.')
