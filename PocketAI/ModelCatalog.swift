// Catalog metadata verified from Hugging Face on September 10, 2026.
// Immutable revisions and upstream file hashes; weights are downloaded only on user action.
import Foundation

enum ModelCatalog {
    static let models: [DownloadableModel] = [
        DownloadableModel(id: "mlx-community/Qwen3-0.6B-4bit", name: "Qwen3 0.6B · 4-bit", revision: "73e3e38d981303bc594367cd910ea6eb48349da8", files: [
            ModelFile(name: "README.md", bytes: 873, hash: "347f24b0faf9b91a5f37326cf2c4595522521ec5", hashKind: .gitSHA1),
            ModelFile(name: "added_tokens.json", bytes: 707, hash: "b54f9135e44c1e81047e8d05cb027af8bc039eed", hashKind: .gitSHA1),
            ModelFile(name: "config.json", bytes: 937, hash: "6c974b02334f2f5f68de4cb2796ee4fe80bfc712", hashKind: .gitSHA1),
            ModelFile(name: "merges.txt", bytes: 1671853, hash: "31349551d90c7606f325fe0f11bbb8bd5fa0d7c7", hashKind: .gitSHA1),
            ModelFile(name: "model.safetensors", bytes: 335450584, hash: "392e8d466d56100ada00eb82031fb854297fc9e389b7d303eba3af114e87bce2", hashKind: .sha256),
            ModelFile(name: "model.safetensors.index.json", bytes: 49731, hash: "e743a6a7d2ba4fd21b2256d739117cbf31345297", hashKind: .gitSHA1),
            ModelFile(name: "special_tokens_map.json", bytes: 613, hash: "ac23c0aaa2434523c494330aeb79c58395378103", hashKind: .gitSHA1),
            ModelFile(name: "tokenizer.json", bytes: 11422654, hash: "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4", hashKind: .sha256),
            ModelFile(name: "tokenizer_config.json", bytes: 9706, hash: "7345216a0785dc7086e8c245b2a9d3896ce2b756", hashKind: .gitSHA1),
            ModelFile(name: "vocab.json", bytes: 2776833, hash: "4783fe10ac3adce15ac8f358ef5462739852c569", hashKind: .gitSHA1),
        ]),
        DownloadableModel(id: "mlx-community/Qwen3-1.7B-4bit", name: "Qwen3 1.7B · 4-bit", revision: "3b1b1768f8f8cf8351c712464f906e86c2b8269e", files: [
            ModelFile(name: "README.md", bytes: 873, hash: "c091c6a52b254dd7954cf9bde247650b1f0b895b", hashKind: .gitSHA1),
            ModelFile(name: "added_tokens.json", bytes: 707, hash: "b54f9135e44c1e81047e8d05cb027af8bc039eed", hashKind: .gitSHA1),
            ModelFile(name: "config.json", bytes: 937, hash: "0a78ffc3980b062021a450199988d0ed8537239d", hashKind: .gitSHA1),
            ModelFile(name: "merges.txt", bytes: 1671853, hash: "31349551d90c7606f325fe0f11bbb8bd5fa0d7c7", hashKind: .gitSHA1),
            ModelFile(name: "model.safetensors", bytes: 968080210, hash: "0e86d9677e519323849eac1bc272caae88567a481ff188c431f70be543d9995f", hashKind: .sha256),
            ModelFile(name: "model.safetensors.index.json", bytes: 49731, hash: "8607d041b6549c15a4db85e7b4c5cf30d3ab890a", hashKind: .gitSHA1),
            ModelFile(name: "special_tokens_map.json", bytes: 613, hash: "ac23c0aaa2434523c494330aeb79c58395378103", hashKind: .gitSHA1),
            ModelFile(name: "tokenizer.json", bytes: 11422654, hash: "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4", hashKind: .sha256),
            ModelFile(name: "tokenizer_config.json", bytes: 9706, hash: "7345216a0785dc7086e8c245b2a9d3896ce2b756", hashKind: .gitSHA1),
            ModelFile(name: "vocab.json", bytes: 2776833, hash: "4783fe10ac3adce15ac8f358ef5462739852c569", hashKind: .gitSHA1),
        ]),
    ]
}
