import { BigInt } from '@graphprotocol/graph-ts'
import {
  DeployedHumanAccount,
  OwnershipTransferred
} from '../generated/HumanAccountFactory/HumanAccountFactory'
import { HumanAccount, HumanAccountFactory } from '../generated/schema'

export function handleDeployedHumanAccount(event: DeployedHumanAccount): void {
  let factory = HumanAccountFactory.load(event.address.toHex())
  if (factory == null) {
    factory = new HumanAccountFactory(event.address.toHex())
    factory.address = event.address
    factory.accountCount = BigInt.fromI32(0)
    factory.accounts = []
    factory.usernames = []
    factory.save()
  }

  const account = new HumanAccount(event.params.account.toHex())
  account.username = event.params.username
  account.owner = event.params.owner
  account.address = event.params.account
  account.signers = []

  factory.accountCount = factory.accountCount.plus(BigInt.fromI32(1))
  factory.accounts = factory.accounts.concat([account.id])
  factory.usernames = factory.usernames.concat([account.username])

  factory.save()
  account.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}
