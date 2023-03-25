import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployHumanAccountFactory: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()

  const entrypoint = await hre.deployments.get('EntryPoint')
  const ret = await hre.deployments.deploy('HumanAccountFactory', {
    from,
    args: [entrypoint.address, from],
    gasLimit: 6e6,
    deterministicDeployment: true
  })
  console.log('==HumanAccountFactory addr=', ret.address)

  const factory = await hre.deployments.get('HumanAccountFactory')

  const humanAccountFactory = await ethers.getContractAt(
    'HumanAccountFactory',
    factory.address,
    provider.getSigner()
  )
  // depositETH to factory
  const depositEth = await humanAccountFactory.depositEth({
    value: ethers.utils.parseEther('0.1')
  })

  await depositEth.wait()
}

export default deployHumanAccountFactory
