// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

// ACL Module contract that is responsible for the access control of HumanAccounts
// This contract is called within the validateUserOp method of the HumanAccountContract
// to validate the transactions.
// This module is common for all deployed HumanAccounts

contract ACLModule {
    // The address of the HumanAccountFactory contract
    address public factory;
}
