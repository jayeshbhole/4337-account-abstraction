import dotenv from 'dotenv'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import { HardhatUserConfig } from 'hardhat/config'
import 'hardhat-deploy'
import '@nomiclabs/hardhat-etherscan'

import 'solidity-coverage'

import * as fs from 'fs'

dotenv.config()

const mnemonicFileName =
  process.env.MNEMONIC_FILE ??
  `${process.env.HOME}/.secret/testnet-mnemonic.txt`
let mnemonic = 'test '.repeat(11) + 'junk'
if (fs.existsSync(mnemonicFileName)) {
  mnemonic = fs.readFileSync(mnemonicFileName, 'ascii')
}

function getNetwork1(url: string): {
  url: string
  accounts: { mnemonic: string }
} {
  return {
    url,
    accounts: { mnemonic: process.env.MNEMONIC ?? mnemonic }
  }
}

function getNetwork(name: string): {
  url: string
  accounts: { mnemonic: string }
} {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`)
  // return getNetwork1(`wss://${name}.infura.io/ws/v3/${process.env.INFURA_ID}`)
}

const optimizedComilerSettings = {
  version: '0.8.17',
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true
  }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.15',
        settings: {
          optimizer: { enabled: true, runs: 1000000 }
        }
      }
    ],
    overrides: {
      'contracts/core/EntryPoint.sol': optimizedComilerSettings,
      'contracts/samples/SimpleAccount.sol': optimizedComilerSettings,
      'contracts/humanwallet/HumanAccount.sol': optimizedComilerSettings
    }
  },
  networks: {
    dev: { url: 'http://localhost:8545' },
    // github action starts localgeth service, for gas calculations
    localgeth: { url: 'http://localgeth:8545' },
    goerli: {
      // ...getNetwork('goerli')
      url: 'https://node.stackup.sh/v1/rpc/b897c9c892dcbdafdca0dc2c36bd7110f538e47f7c9671b8e9123593bb424ca4',
      accounts: { mnemonic: process.env.MNEMONIC ?? mnemonic }
    },
    sepolia: getNetwork('sepolia'),
    proxy: getNetwork1('http://127.0.0.1:8545'),
    mumbai: {
      url: process.env.MUMBAI_URL ?? '',
      accounts: { mnemonic: process.env.MNEMONIC ?? '' },
      verify: {
        etherscan: {
          apiUrl: 'https://api-testnet.polygonscan.com',
          apiKey: '31EXVHGVBN613PIMHC9399FH2XVR7W8JFH'
        }
      }
    }
  },
  mocha: {
    timeout: 10000
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

// coverage chokes on the "compilers" settings
if (process.env.COVERAGE != null) {
  // @ts-ignore
  config.solidity = config.solidity.compilers[0]
}

export default config
