import { validCoordinates, type Coordinates, type LocationProvider } from './location';
export class BrowserLocationProvider implements LocationProvider {
  private authorizedThisSession = false;
  constructor(private geo = globalThis.navigator?.geolocation, private permissions = globalThis.navigator?.permissions, private foreground = () => globalThis.document?.visibilityState === 'visible', private secure = () => globalThis.isSecureContext, private report: (message:string)=>void = () => {}, private enabled: () => boolean = () => false) {}
  async current(signal: AbortSignal, requestPermission = false): Promise<Coordinates | undefined> {
    signal.throwIfAborted();
    if (!this.geo || !this.secure() || !this.foreground()) { this.report('Device location unavailable: requires a visible app, secure connection and browser geolocation support.'); return; }
    if (!requestPermission) {
      let state: PermissionState | undefined;
      try { state = (await this.permissions?.query({name:'geolocation'}))?.state; } catch { /* Some browsers lack Geolocation Permissions API support. */ }
      if (state === 'denied') { this.authorizedThisSession=false; this.report('Device location permission denied. Using manual/saved location.'); return; }
      if (state !== 'granted' && !this.authorizedThisSession && !this.enabled()) { this.report('Location permission could not be confirmed. Press Enable or Refresh device location to authorize this session; using manual/saved location.'); return; }
    }
    const timeout = requestPermission ? 45000 : 20000;
    this.report('Requesting a foreground device coordinate reading…');
    return new Promise((resolve,reject) => {
      let finished = false;
      const finish = (value?: Coordinates) => { if (finished) return; finished = true; signal.removeEventListener('abort',abort); clearTimeout(timer); resolve(value); };
      const unavailable = (message:string) => { if (finished) return; this.report(message); finish(); };
      const abort = () => { if (finished) return; finished=true; clearTimeout(timer); signal.removeEventListener('abort',abort); reject(signal.reason ?? new DOMException('Aborted','AbortError')); };
      const timer = setTimeout(() => unavailable('Device location timed out. Using manual/saved location.'),timeout+500);
      signal.addEventListener('abort',abort,{once:true});
      if (signal.aborted) { abort(); return; }
      try { this.geo!.getCurrentPosition(p => {
        if (finished) return;
        const c = {latitude:Math.round(p.coords.latitude*100)/100,longitude:Math.round(p.coords.longitude*100)/100};
        if (!this.foreground() || !validCoordinates(c)) { unavailable('Device reading was invalid or the app left the foreground. Using manual/saved location.'); return; }
        this.authorizedThisSession = true;
        this.report(`Device coordinates received: ${c.latitude.toFixed(2)}, ${c.longitude.toFixed(2)} (approximate).`);
        finish(c);
      }, error => {
        if (error.code === 1) this.authorizedThisSession = false;
        unavailable(error.code === 1 ? 'Device location permission denied. Using manual/saved location.' : error.code === 3 ? 'Device location timed out. Using manual/saved location.' : 'Device location services could not supply coordinates. Using manual/saved location.');
      }, {enableHighAccuracy:false,maximumAge:60000,timeout}); }
      catch { unavailable('Browser location request failed. Using manual/saved location.'); }
    });
  }
}
