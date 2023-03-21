/* eslint-disable @typescript-eslint/no-unused-vars */
// run a single op
// "yarn run runop [--network ...]"

import hre, { ethers } from 'hardhat'
import { objdump } from '../test/testutils'
import {
  AADeviceSigner,
  AAHumanSigner,
  localUserOpSender,
  rpcUserOpSender
} from './AAHumanSigner'
import { TestCounter__factory, EntryPoint__factory } from '../typechain'
import '../test/aa.init'
import { parseEther } from 'ethers/lib/utils'
import { providers } from 'ethers'
import { TransactionReceipt } from '@ethersproject/abstract-provider/src.ts/index'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  console.log('net=', hre.network.name)
  const aa_url = process.env.AA_URL

  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (aa_url == null && !process.env.FORCE_DEPLOY) {
    await hre.run('deploy')
    const chainId = await hre.getChainId()
    if (chainId.match(/1337/) == null) {
      console.log('chainid=', chainId)
      await hre.run('etherscan-verify')
    }
  }
  const [entryPointAddress, testCounterAddress, humanAccountFactoryAddress] =
    await Promise.all([
      hre.deployments.get('EntryPoint').then((d) => d.address),
      hre.deployments.get('TestCounter').then((d) => d.address),
      hre.deployments.get('HumanAccountFactory').then((d) => d.address)
    ])

  console.log(
    '\n\nentryPointAddress:',
    entryPointAddress,
    '\ntestCounterAddress:',
    testCounterAddress,
    '\nhumanAccountFactoryAddress:',
    humanAccountFactoryAddress
  )

  const provider = ethers.provider
  const ethersOwnerSigner = provider.getSigner(0)
  const prefundAccountAddress = await ethersOwnerSigner.getAddress()
  const prefundAccountBalance = await provider.getBalance(prefundAccountAddress)
  console.log(
    '\n\nusing prefund account address',
    prefundAccountAddress,
    'with balance',
    prefundAccountBalance.toString()
  )

  let sendUserOp

  if (aa_url != null) {
    const newprovider = new providers.JsonRpcProvider(aa_url)
    sendUserOp = rpcUserOpSender(newprovider, entryPointAddress)
    const supportedEntryPoints: string[] = await newprovider
      .send('eth_supportedEntryPoints', [])
      .then((ret) => ret.map(ethers.utils.getAddress))
    console.log('node supported EntryPoints=', supportedEntryPoints)
    if (!supportedEntryPoints.includes(entryPointAddress)) {
      console.error('ERROR: node', aa_url, 'does not support our EntryPoint')
    }
  } else {
    sendUserOp = localUserOpSender(entryPointAddress, ethersOwnerSigner)
  }

  // index is unique for an account (so same owner can have multiple accounts, with different index
  const index = parseInt(process.env.AA_INDEX ?? '0')
  console.log('using account index (AA_INDEX)', index)
  const aaOwnerSigner = new AAHumanSigner(
    ethersOwnerSigner,
    entryPointAddress,
    humanAccountFactoryAddress,
    sendUserOp,
    index,
    provider,
    'HumanAccount_1'
  )

  // console.log('\n\n====deploy HumanAccountFactory')
  // // deploy HumanAccount1 by calling HumanAccountFactory
  // const humanAccountFactoryContract = await ethers.getContractAt(
  //   'HumanAccountFactory',
  //   humanAccountFactoryAddress,
  //   ethersOwnerSigner
  // )
  // const createHumanAccount1 = await humanAccountFactoryContract.createAccount(
  //   'HumanAccount_1',
  //   0,
  //   ethersOwnerSigner.getAddress()
  // )
  // const receipt = await createHumanAccount1.wait()

  // const deploy_event = receipt.events?.find(
  //   (e) => e?.event === 'DeployedHumanAccount'
  // )

  // const humanAccount1Address = deploy_event?.args?.account
  // console.log('==HumanAccount1 addr=', humanAccount1Address)
  const humanAccount1Address = await aaOwnerSigner.getFactoryDeploymentAddress()
  console.log('==HumanAccount1 addr=', humanAccount1Address)

  console.log('/// expected', await aaOwnerSigner._deploymentAddress())

  const deployedAccount1 = await ethers.getContractAt(
    'HumanAccount',
    humanAccount1Address,
    aaOwnerSigner
  )

  // // connect to pre-deployed account
  // await aaOwnerSigner.connectAccountAddress(humanAccount1Address)

  const humanAccountAddress = await aaOwnerSigner.getAddress()

  if ((await provider.getBalance(humanAccount1Address)) < parseEther('0.01')) {
    console.log('prefund account')
    await ethersOwnerSigner.sendTransaction({
      to: humanAccount1Address,
      value: parseEther('0.01')
    })
  }

  // usually, an account will deposit for itself (that is, get created using eth, run "addDeposit" for itself
  // and from there on will use deposit
  // for testing,
  const entryPoint = EntryPoint__factory.connect(
    entryPointAddress,
    ethersOwnerSigner
  )
  console.log('account address=', humanAccount1Address)
  let preDeposit = await entryPoint.balanceOf(humanAccount1Address)
  console.log(
    'current deposit=',
    preDeposit,
    'current balance',
    await provider.getBalance(humanAccount1Address)
  )

  if (preDeposit.lte(parseEther('0.005'))) {
    console.log('depositing for account')
    await entryPoint.depositTo(humanAccount1Address, {
      value: parseEther('0.01')
    })
    preDeposit = await entryPoint.balanceOf(humanAccount1Address)
  }

  const prebalance = await provider.getBalance(humanAccount1Address)
  console.log(
    'balance=',
    prebalance.div(1e9).toString(),
    'deposit=',
    preDeposit.div(1e9).toString()
  )

  // use second hardhat account
  const ethersDeviceSigner = provider.getSigner(1)

  const devicePubKey = await ethersDeviceSigner.getAddress()
  console.log('\n________\ndevicePubKey=', devicePubKey)

  const registerRequestHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['address'], [devicePubKey])
  )
  // sign the public key with the account's private key
  const sig = await ethersOwnerSigner.signMessage(
    ethers.utils.arrayify(registerRequestHash)
  )

  console.log('===registering device key', devicePubKey)

  // // register the public key with the smart contract account
  // // const registerKey1Tx = await deployedAccount1.registerDeviceKey(
  // //   devicePubKey,
  // //   sig
  // // )
  // // await registerKey1Tx.wait()

  // register the public key with the smart contract account
  const registerKey1Tx = await deployedAccount1.registerDeviceKey(
    devicePubKey,
    sig
  )
  await registerKey1Tx.wait()

  const aaDeviceSigner = new AADeviceSigner(
    ethersDeviceSigner,
    entryPointAddress,
    humanAccountFactoryAddress,
    sendUserOp,
    index,
    provider,
    'HumanAccount_1'
  )
  await aaDeviceSigner.connectAccountAddress(humanAccount1Address)

  // const testCounter = TestCounter__factory.connect(
  //   testCounterAddress,
  //   aaDeviceSigner
  // )

  // console.log('estimate direct call', {
  //   gasUsed: await testCounter
  //     .connect(aaDeviceSigner)
  //     .estimateGas.justemit()
  //     .then((t) => t.toNumber())
  // })
  // const ret = await testCounter.justemit()
  // console.log('waiting for mine, hash (reqId)=', ret.hash)
  // const rcpt = await ret.wait()
  // const netname = await provider.getNetwork().then((net) => net.name)
  // if (netname !== 'unknown') {
  //   console.log(
  //     'rcpt',
  //     rcpt.transactionHash,
  //     `https://dashboard.tenderly.co/tx/${netname}/${rcpt.transactionHash}/gas-usage`
  //   )
  // }
  // const gasPaid = prebalance.sub(
  //   await provider.getBalance(humanAccount1Address)
  // )
  // const depositPaid = preDeposit.sub(
  //   await entryPoint.balanceOf(humanAccount1Address)
  // )
  // console.log(
  //   'paid (from balance)=',
  //   gasPaid.toNumber() / 1e9,
  //   'paid (from deposit)',
  //   depositPaid.div(1e9).toString(),
  //   'gasUsed=',
  //   rcpt.gasUsed
  // )
  // const logs = await entryPoint.queryFilter('*' as any, rcpt.blockNumber)
  // console.log(logs.map((e: any) => ({ ev: e.event, ...objdump(e.args!) })))
  // console.log('1st run gas used:', await evInfo(rcpt))

  // const ret1 = await testCounter.justemit()
  // const rcpt2 = await ret1.wait()
  // console.log('2nd run:', await evInfo(rcpt2))

  // // remove device key access
  // const removeRequestHash = ethers.utils.keccak256(
  //   ethers.utils.defaultAbiCoder.encode(['address'], [devicePubKey])
  // )
  // const removeSig = await ethersOwnerSigner.signMessage(
  //   ethers.utils.arrayify(removeRequestHash)
  // )
  // const removeKeyTx = await deployedAccount1.removeDeviceKey(
  //   devicePubKey,
  //   removeSig
  // )
  // await removeKeyTx.wait()

  // // try to call again
  // try {
  //   const ret2 = await testCounter.justemit()
  //   const rcpt3 = await ret2.wait()
  //   console.log('3rd run:', await evInfo(rcpt3))
  // } catch (e) {
  //   console.log('expected error in sig validation')
  // }

  // async function evInfo(rcpt: TransactionReceipt): Promise<any> {
  //   // TODO: checking only latest block...
  //   const block = rcpt.blockNumber
  //   const ev = await entryPoint.queryFilter(
  //     entryPoint.filters.UserOperationEvent(),
  //     block
  //   )
  //   // if (ev.length === 0) return {}
  //   return ev.map((event) => {
  //     const { nonce, actualGasUsed } = event.args
  //     const gasUsed = rcpt.gasUsed.toNumber()
  //     return {
  //       nonce: nonce.toNumber(),
  //       gasPaid,
  //       gasUsed: gasUsed,
  //       diff: gasUsed - actualGasUsed.toNumber()
  //     }
  //   })
  // }
})()
