#!/usr/bin/env node

const yargs = require("yargs");

const askForPassword = require("./utils/askForPassword");

const { generateWalletFromPassword, getConfirmedBalanceFromAddress, sendBtc, drainBtc } = require("./utils/bitcoin");


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
      console.log(`\n${address}`)
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
      console.log(`\n${balance}`)
    })
    .command("wif", "Get WIF", {
      t: {
        alias: "type",
        describe: "Address Type",
        demandOption: false,
        type: "string"
      },
    },
    async (args) => {
      const password = await askForPassword("Enter your password: ");
      const { address, wif } = await generateWalletFromPassword(password)
      console.log(`${wif}`)
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
        const { success, result } = await sendBtc({ address, wif }, args.destination, parseInt(args.amount), parseInt(args.satsbyte))
        if (!success) {
          console.log("Error while transfer")
          console.log(result)
          return
        }
        console.log(`\nhttps://mempool.space/tx/${result}`)
      } catch (error) {
        console.error(error)
      }
    })
    .command("drain", "Execute transaction", {
      d: {
        alias: "destination",
        describe: "Destination address",
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
        const { success, result } = await drainBtc({ address, wif }, args.destination, parseInt(args.satsbyte))
        if (!success) {
          console.log("Error while transfer")
          console.log(result)
          return
        }
        console.log(`\nhttps://mempool.space/tx/${result}`)
      } catch (error) {
        console.error(error)
      }
    })
    .help()
    .argv;

})();