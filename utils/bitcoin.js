const bitcoin = require("bitcoinjs-lib");
const { ECPairFactory } = require("ecpair");
const ecc = require("tiny-secp256k1");
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)
const crypto = require('crypto');
const {BIP32Factory} = require('bip32')
const bip39 = require('bip39')
const bip32 = BIP32Factory(ecc)

const network = bitcoin.networks.bitcoin
const MEMPOOL_URL = `https://mempool.space`

// configuration for testnet
// const network = bitcoin.networks.testnet
// const MEMPOOL_URL = `https://mempool.space/testnet`

const DUST_LIMIT = 546
const BASE_TX_SIZE = 10

const BitcoinAddressType = {
  Legacy: 'legacy',
  NestedSegwit: 'nested-segwit',
  NativeSegwit: 'native-segwit',
  Taproot: 'taproot',
  Invalid: 'invalid'
}

const LEGACY_TX_INPUT_SIZE = 148
const LEGACY_TX_OUTPUT_SIZE = 34
const NESTED_SEGWIT_TX_INPUT_SIZE = 91
const NESTED_SEGWIT_TX_OUTPUT_SIZE = 31
const NATIVE_SEGWIT_TX_INPUT_SIZE = 68
const NATIVE_SEGWIT_TX_OUTPUT_SIZE = 31
const TAPROOT_TX_INPUT_SIZE = 58
const TAPROOT_TX_OUTPUT_SIZE = 43

// Function to fetch unspent transaction outputs (UTXOs) for the fromAddress
async function getUTXOs(address) {
  const url = `${MEMPOOL_URL}/api/address/${address}/utxo`
  const response = await fetch(url)
  if (response.ok) {
    const utxo_array = await response.json()
    let confirmed = [], unconfirmed = []
    for (const i in utxo_array)
      utxo_array[i]['status']['confirmed'] ? confirmed.push(utxo_array[i]) : unconfirmed.push(utxo_array[i])
    return {
      success: true,
      confirmed: utxo_array.filter((elem) => elem?.status?.confirmed) || [],
      unconfirmed: utxo_array.filter((elem) => !elem?.status?.confirmed) || []
    }
  }
  else {
    return {
      success: false,
      confirmed: [],
      unconfirmed: []
    }
  }
}

// Function to get confirmed total balance of a bitcoin address
async function getConfirmedBalanceFromAddress(address) {
  const { confirmed } = await getUTXOs(address)
  let totalBalance = 0
  for (const i in confirmed)
    totalBalance += parseInt(confirmed[i]['value'])
  return totalBalance
}

// Function to get current mempool status
async function getSatsbyte() {
  const url = `${MEMPOOL_URL}/api/v1/fees/recommended`
  const response = await fetch(url)
  if (response.ok) {
    const recommendedFees = await response.json()
    return {
      success: true,
      recommendedFees
    }
  }
  else {
    return {
      success: false,
      recommendedFees: {}
    }
  }
}

// Function to determine what type of address it is among 4 bitcoin address types
function getBitcoinAddressType(address) {
  // Regular expressions for different Bitcoin address types
  const legacyRegex = network === bitcoin.networks.bitcoin ? /^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/ : /^[m,n][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const nestedSegwitRegex = network === bitcoin.networks.bitcoin ? /^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/ : /^[2][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const nativeSegwitRegex = network === bitcoin.networks.bitcoin ? /^(bc1q)[0-9a-z]{35,59}$/ : /^(tb1q)[0-9a-z]{35,59}$/;
  const taprootRegex = network === bitcoin.networks.bitcoin ? /^(bc1p)[0-9a-z]{39,59}$/ : /^(tb1p)[0-9a-z]{39,59}$/;

  if (legacyRegex.test(address)) {
    return BitcoinAddressType.Legacy;
  } else if (nestedSegwitRegex.test(address)) {
    return BitcoinAddressType.NestedSegwit;
  } else if (nativeSegwitRegex.test(address)) {
    return BitcoinAddressType.NativeSegwit;
  } else if (taprootRegex.test(address)) {
    return BitcoinAddressType.Taproot;
  } else {
    return BitcoinAddressType.Invalid;
  }
}

function getAddressFromWIFandType(wif, type) {
  const keyPair = ECPair.fromWIF(wif);

  if (type === BitcoinAddressType.Legacy)
    return bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network }).address
  else if (type === BitcoinAddressType.NestedSegwit)
    return bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }),
      network
    }).address;
  else if (type === BitcoinAddressType.NativeSegwit)
    return bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address
  else if (type === BitcoinAddressType.Taproot)
    return bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keyPair.publicKey),
      network
    }).address;
  else
    return "invalid"
}

function toXOnly (publicKey) {
  return publicKey.slice(1, 33);
}

function getKeypairInfo (childNode) {
  const childNodeXOnlyPubkey = toXOnly(childNode.publicKey);

  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey,
    network
  });

  const tweakedChildNode = childNode.tweak(
    bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
  );

  return {
    address,
    tweakedChildNode,
    childNodeXOnlyPubkey,
    output,
    childNode
  }
}

// Function to estimate transaction size from input utxos and output utxos and the address type
function estimateTransactionSize(numInputs, numOutputs, type) {
  let inputSize, outputSize

  switch (type) {
    case BitcoinAddressType.Legacy:
      inputSize = LEGACY_TX_INPUT_SIZE;
      outputSize = LEGACY_TX_OUTPUT_SIZE;
      break;
    case BitcoinAddressType.NestedSegwit:
      inputSize = NESTED_SEGWIT_TX_INPUT_SIZE;
      outputSize = NESTED_SEGWIT_TX_OUTPUT_SIZE;
      break;
    case BitcoinAddressType.NativeSegwit:
      inputSize = NATIVE_SEGWIT_TX_INPUT_SIZE;
      outputSize = NATIVE_SEGWIT_TX_OUTPUT_SIZE;
      break;
    case BitcoinAddressType.Taproot:
      inputSize = TAPROOT_TX_INPUT_SIZE;
      outputSize = TAPROOT_TX_OUTPUT_SIZE;
      break;
    default:
      throw new Error('Unknown transaction type');
  }

  return BASE_TX_SIZE + (numInputs * inputSize) + (numOutputs * outputSize);
}

function estimateTransactionFee(numInputs, numOutputs, type, feeRate) {
  const txSize = estimateTransactionSize(numInputs, numOutputs, type);
  return txSize * feeRate;
}

async function getTransactionDetailFromTxID(txid) {
  const url = `${MEMPOOL_URL}/api/tx/${txid}/hex`
  const response = await fetch(url)
  if (response.ok) {
    const hex = await response.text()
    const txDetail = bitcoin.Transaction.fromHex(hex)
    return {
      hex,
      txDetail
    }
  }
  return {
    hex: "",
    txDetail: {}
  }
}

// Function to send bitcoin from one address to another
// returns the txid when success, error msg when error
async function sendBtc(fromAddressPair, toAddress, amountInSats, satsbyte) {

  // validate address types
  const { address: fromAddress, wif: fromWIF } = fromAddressPair
  const fromAddressType = getBitcoinAddressType(fromAddress)
  if (fromAddressType === BitcoinAddressType.Invalid)
    throw "Invalid Source Address"

  const toAddressType = getBitcoinAddressType(toAddress)
  if (toAddressType === BitcoinAddressType.Invalid)
    throw "Invalid Destination Address"

  // first check if that address holds such balance
  const currentBalance = await getConfirmedBalanceFromAddress(fromAddress)
  if (amountInSats >= currentBalance)
    throw "Insufficient balance"

  // check if fromWIF matches the fromAddress
  const checkingFromAddress = getAddressFromWIFandType(fromWIF, fromAddressType);
  if (fromAddress !== checkingFromAddress)
    throw "Source Address does not match WIF"

  // now building transactions based on address types
  const keyPair = ECPair.fromWIF(fromAddressPair.wif);
  const keyPairInfo = getKeypairInfo(keyPair)
  const { confirmed } = await getUTXOs(fromAddress)
  const sortedUTXOs = confirmed.sort((a, b) => parseInt(a.value) - parseInt(b.value))

  const fastestFee = satsbyte

  // build transaction
  const psbt = new bitcoin.Psbt({ network });
  let totalInputSats = 0, inputUtxoCount = 0
  let estimatedTransactionFee = estimateTransactionFee(1, 1, toAddressType, fastestFee)
  let inputsAreEnough = false
  for (const i in sortedUTXOs) {
    const { txid, vout, value } = sortedUTXOs[i]
    // Eric bro... better to store transaction hex on the database so that you can reduce unnecessary API calls...
    const { hex, txDetail } = await getTransactionDetailFromTxID(txid)
    if (!hex) {
      return {
        success: false,
        result: `cannot find proper hex for transaction ${txid}`
      }
    }
    const input = {
      hash: txid,
      index: vout
    }

    if (fromAddressType === BitcoinAddressType.Legacy)
      input.nonWitnessUtxo = Buffer.from(hex, 'hex');
    if (fromAddressType === BitcoinAddressType.NestedSegwit) {
      input.witnessUtxo = {
        script: txDetail.outs[vout].script,
        value: txDetail.outs[vout].value,
      }
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network });
      input.redeemScript = p2wpkh.output
    }
    if (fromAddressType === BitcoinAddressType.NativeSegwit)
      input.witnessUtxo = {
        script: txDetail.outs[vout].script,
        value: txDetail.outs[vout].value,
      };
    if (fromAddressType === BitcoinAddressType.Taproot) {
      input.witnessUtxo = {
        script: txDetail.outs[vout].script,
        value: txDetail.outs[vout].value,
      };
      input.tapInternalKey = keyPairInfo.childNodeXOnlyPubkey
    }

    psbt.addInput(input)
    inputUtxoCount ++
    totalInputSats += value
    estimatedTransactionFee = estimateTransactionFee(inputUtxoCount, 2, toAddressType, fastestFee)
    if (totalInputSats >= amountInSats + estimatedTransactionFee) {
      inputsAreEnough = true
      psbt.addOutput({
        address: toAddress, 
        value: amountInSats
      })
      if (totalInputSats - amountInSats - estimatedTransactionFee > DUST_LIMIT) 
        psbt.addOutput({
          address: fromAddress, 
          value: totalInputSats - amountInSats - estimatedTransactionFee
        })
    }
  }

  if (!inputsAreEnough) {
    return {
      success: false,
      result: "Input UTXOs are not enough to send..."
    }
  }

  // console.log(`sending ${amountInSats} from ${fromAddress} to ${toAddress}`)
  // console.log(`estimatedFee: ${estimatedTransactionFee}`)
  // console.log(`firing tx at ${fastestFee} satsbyte`)

  if (fromAddressType === BitcoinAddressType.Taproot) {
    for (let i = 0; i < inputUtxoCount; i ++)
      psbt.signInput(i, keyPairInfo.tweakedChildNode)
  }
  else {
    for (let i = 0; i < inputUtxoCount; i ++)
      psbt.signInput(i, keyPairInfo.childNode)
  }

  psbt.finalizeAllInputs()

  const tx = psbt.extractTransaction()
  const txHex = tx.toHex();
  // console.log(`raw transaction hex: ${txHex}`)

  // broadcast the transaction
  const broadcastAPI = `${MEMPOOL_URL}/api/tx`
  const response = await fetch(broadcastAPI, {
    method: "POST",
    body: txHex,
  })

  if (response.ok) {
    const transactionId = await response.text()
    return {
      success: true,
      result: transactionId
    }
  }

  throw 'Error while broadcast...'
}

function generateHash(input) {
  return crypto.createHash('sha256') // Use SHA-256 algorithm
    .update(input)        // Hash the input string
    .digest('hex');       // Output the hash in hex format
}

function generateMnemonicFromPassword (pwd) {
  const hash = generateHash(pwd)
  const mnemonic = bip39.entropyToMnemonic(hash)
  if (!bip39.validateMnemonic(mnemonic)) {
    return null
  }
  return mnemonic
}

// I have to add address type option so that CLI users can select Legacy/Segwit as well
// Right now, only Taproot
async function generateBitcoinAddressFromMnemonic (mnemonic) {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootKey = bip32.fromSeed(seed);
  const childNode86 = rootKey.derivePath(`m/86'/0'/0'/0/0`)
  const childNodeXOnlyPubkey86 = toXOnly(childNode86.publicKey);
  const { address: taproot86 } = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey86,
    network: bitcoin.networks.bitcoin
  });
  return taproot86
}

async function getWIFFromMnemonic (mnemonic) {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootKey = bip32.fromSeed(seed);
  const childNode86 = rootKey.derivePath(`m/86'/0'/0'/0/0`)
  return childNode86.toWIF()
}

async function generateWalletFromPassword (pwd) {
  const mnemonic = generateMnemonicFromPassword(pwd)
  const wif = await getWIFFromMnemonic(mnemonic)
  const address = await generateBitcoinAddressFromMnemonic(mnemonic)
  return {
    mnemonic,
    wif,
    address
  }
}

module.exports = {
  getUTXOs,
  getBitcoinAddressType,
  getConfirmedBalanceFromAddress,
  generateMnemonicFromPassword,
  generateBitcoinAddressFromMnemonic,
  generateWalletFromPassword,
  getWIFFromMnemonic,
  getSatsbyte,
  sendBtc,
};