#!/usr/bin/env node

const yargs = require("yargs");

const askForPassword = require("./utils/askForPassword");

const { generateWalletFromPassword, getConfirmedBalanceFromAddress, sendBtc } = require("./utils/bitcoin");


(async () => {

  const argv = await yargs
    .command("addy", "Get Address", {
      t: {
        alias: "type",
        describe: "Address Type",
        demandOption: false,
        type: "string"
      },
    },
    async (args) => {
      const password = await askForPassword("Enter your password: ");
      const { address } = await generateWalletFromPassword(password)
      console.log(address)
    })
    .command("check", "Check Sats", {
      t: {
        alias: "type",
        describe: "Address Type",
        demandOption: false,
        type: "string"
      },
    },
    async (args) => {
      const password = await askForPassword("Enter your password: ");
      const { address } = await generateWalletFromPassword(password)
      const balance = await getConfirmedBalanceFromAddress(address)
      console.log(balance)
    })
    .command("trans", "Execute transaction", {
      d: {
        alias: "destination",
        describe: "Destination address",
        demandOption: true,
        type: "string"
      },
      a: {
        alias: "amount",
        describe: "Amount in sats",
        demandOption: true,
        type: "string"
      },
      s: {
        alias: "satsbyte",
        describe: "Satoshis per byte",
        demandOption: true,
        type: "number"
      },
    },
    async (args) => {
      const password = await askForPassword("Enter your password: ");
      const { mnemonic, wif, address } = await generateWalletFromPassword(password)
      try {
        const { success, result: txId } = await sendBtc({ address, wif }, args.destination, args.amount, args.satsbyte)
        console.log(`https://mempool.space/tx/${txId}`)
      } catch (error) {
        console.error(error)
      }
    })
    .help()
    .argv;

})();