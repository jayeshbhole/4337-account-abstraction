import { BigInt } from '@graphprotocol/graph-ts'
import { DeployedHumanAccount } from '../generated/HumanAccountFactory/HumanAccountFactory'
import { HumanAccount, HumanAccountFactory } from '../generated/schema'

export function handleDeployedHumanAccount(event: DeployedHumanAccount): void {
  let factory = HumanAccountFactory.load(event.address.toHex())
  if (factory == null) {
    factory = new HumanAccountFactory(event.address.toHex())
    factory.accountCount = BigInt.fromI32(0)
    factory.save()
  }

  const account = new HumanAccount(event.params.account.toHex())
  account.username = event.params.username
  account.owner = event.params.owner

  factory.accountCount = factory.accountCount.plus(BigInt.fromI32(1))
  factory.accounts = factory.accounts.concat([account.id])
  factory.usernames = factory.usernames.concat([account.username])

  factory.save()
  account.save()
}

// export function handleOwnershipTransferred(event: OwnershipTransferred): void {}
