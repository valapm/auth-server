import bsv from "bsv-wasm"

export function getPubKeyHashId(publicKey: bsv.PublicKey): string {
  return bsv.Hash.hash160(publicKey.toBytes()).toHex().slice(0, 8)
}
