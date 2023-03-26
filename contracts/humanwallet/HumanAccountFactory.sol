// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./HumanAccount.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

/**
 * A sample factory contract for HumanAccount
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract HumanAccountFactory is Ownable {
    HumanAccount public immutable accountImplementation;
    IEntryPoint entryPoint;
    address public aclModule;
    mapping(string => address) public usernameToAddress;

    event DeployedHumanAccount(address account, string username, address owner);

    constructor(IEntryPoint _entryPoint, address _owner) {
        accountImplementation = new HumanAccount(_entryPoint, address(this));
        entryPoint = _entryPoint;

        transferOwnership(_owner);
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */

    function createAccount(
        string calldata accountUsername,
        uint256 salt,
        address ownerKey
    ) public returns (HumanAccount ret) {
        address addr = getAddress(accountUsername, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return HumanAccount(payable(addr));
        }

        require(
            usernameToAddress[accountUsername] == address(0),
            "factory: username already taken"
        );

        ret = HumanAccount(
            payable(
                new ERC1967Proxy{ salt: bytes32(salt) }(
                    address(accountImplementation),
                    abi.encodeCall(HumanAccount.initialize, (accountUsername))
                )
            )
        );

        emit DeployedHumanAccount(address(ret), accountUsername, ownerKey);

        console.log("DeployedHumanAccount %s %s", address(ret), accountUsername);

        // set owner of account. called once, and only by the factory.
        ret.setOwnerKey(ownerKey);
        usernameToAddress[accountUsername] = address(ret);
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(
        string calldata accountUsername,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(HumanAccount.initialize, (accountUsername))
                        )
                    )
                )
            );
    }

    function depositEth() public payable {}

    function withdrawEth(uint256 amount) public onlyOwner {
        payable(owner()).transfer(amount);
    }

    // add stake function that stakes eth in the entrypoint
    // stake the full balance of factory
    function stakeToEntryPoint() public onlyOwner {
        entryPoint.addStake{ value: address(this).balance }(300);
    }

    function unlockStake() public onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake() public onlyOwner {
        entryPoint.withdrawStake(payable(owner()));
    }
}
