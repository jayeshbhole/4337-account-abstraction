// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import "../core/BaseAccount.sol";
import "hardhat/console.sol";

/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */
contract HumanAccount is BaseAccount, UUPSUpgradeable, Initializable {
    using ECDSA for bytes32;

    //filler member, to push the nonce and owner to the same slot
    // the "Initializeble" class takes 2 bytes in the first slot
    bytes28 private _filler;

    //explicit sizes of nonce, to fit a single storage cell with "ownerKey"
    uint96 private _nonce;
    address public owner;
    string public username;

    address private immutable factory;

    // access control for device and guardian keys
    mapping(address => bool) public deviceKeys;
    // mapping(address => bool) public guardianKeys;

    IEntryPoint private immutable _entryPoint;

    event HumanAccountInitialized(
        IEntryPoint indexed entryPoint,
        string indexed username
    );
    event HumanAccountOwnerChanged(
        IEntryPoint indexed entryPoint,
        string indexed newOwner
    );

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }
    modifier onlyFactory() {
        require(msg.sender == factory, "only factory");
        _;
    }

    /// @inheritdoc BaseAccount
    function nonce() public view virtual override returns (uint256) {
        return _nonce;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor(
        IEntryPoint anEntryPoint,
        address _factory
    ) {
        _entryPoint = anEntryPoint;
        factory = _factory;
        owner = _factory;
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the account itself (which gets redirected through execute())
        require(
            msg.sender == owner || msg.sender == address(this),
            "only owner"
        );
    }

    function _onlyOwnerSignature(
        bytes calldata signature,
        bytes32 dataHash
    )internal view{
        bytes32 hash = dataHash.toEthSignedMessageHash();
        require(hash.recover(signature) == owner, "account_acl: unauthorised request");
    }

    function registerDeviceKey(address deviceKey, bytes calldata signature) external onlyOwner {
        _onlyOwnerSignature(signature, keccak256(abi.encode(deviceKey)));

        require(deviceKeys[deviceKey] == false, "account_acl: device key already registered");
        require(deviceKey != address(0) || deviceKey != owner, "account_acl: invalid device key");

        deviceKeys[deviceKey] = true;
    }

    function removeDeviceKey(address deviceKey, bytes calldata signature) external onlyOwner {
        _onlyOwnerSignature(signature, keccak256(abi.encode(deviceKey, _nonce)));

        require(deviceKeys[deviceKey] == true, "account_acl: device key not registered");
        require(deviceKey != address(0) || deviceKey != owner, "account_acl: invalid device key");

        deviceKeys[deviceKey] = false;
    }

    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     */
    function executeBatch(
        address[] calldata dest,
        bytes[] calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of HumanAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     */
    function initialize(string calldata anUsername) public virtual initializer {
        _initialize(anUsername);
    }

    function _initialize(string calldata anUsername) internal virtual {
        username = anUsername;

        emit HumanAccountInitialized(_entryPoint, anUsername);
    }

    // set owner key only while initializing
    function setOwnerKey(address newOwner) external onlyFactory {
        require(owner == address(0), "owner already set");
        owner = newOwner;
    }

    function _setOwnerKey(address newOwner) internal {
        require(owner == address(0), "owner already set");
        owner = newOwner;
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwner() internal view {
        require(
            msg.sender == address(entryPoint()) || msg.sender == owner,
            "account: not Owner or EntryPoint"
        );
    }

    /// implement template method of BaseAccount
    function _validateAndUpdateNonce(
        UserOperation calldata userOp
    ) internal override {
        require(_nonce++ == userOp.nonce, "account: invalid nonce");
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address signer = hash.recover(userOp.signature);

        if (!(signer == owner || deviceKeys[signer])){
            console.log("!!! validation failed !!!");
            return SIG_VALIDATION_FAILED;
        }
        return 0;
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * check current account deposit in the entryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * deposit more funds for this account in the entryPoint
     */
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * withdraw value from the account's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) public onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view override {
        (newImplementation);
        _onlyOwner();
    }
}
