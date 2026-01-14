// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITimeOracle.sol";

contract SubscriptionService is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    ITimeOracle public immutable timeOracle;

    struct Service {
        uint256 fee;
        uint256 period;
        address owner;
        uint256 totalEarnings;
    }

    struct Subscription {
        uint256 expiry;
        bool active;
        bool renewalFlagged;
        bool lowBalanceFlagged;
    }

    mapping(uint256 => Service) public services;
    mapping(uint256 => mapping(address => Subscription)) public subscriptions;
    mapping(uint256 => address[]) public serviceSubscribers;

    uint256 public nextServiceId;

    uint256 public constant MIN_SWEEP_THRESHOLD = 0.016 ether;

    event ServiceCreated(uint256 indexed serviceId, address indexed owner, uint256 fee, uint256 period);
    event SubscriptionPaid(address indexed subscriber, uint256 indexed serviceId, uint256 expiry);
    event SubscriptionGifted(address indexed gifter, address indexed beneficiary, uint256 indexed serviceId, uint256 expiry);
    event RenewalFlagged(uint256 indexed serviceId, address indexed subscriber, bool lowBalance);
    event EarningsWithdrawn(address indexed owner, uint256 indexed serviceId, uint256 amount);
    event FeesSwept(uint256 amount);

    constructor(address _keeper, address _timeOracle) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, _keeper);
        timeOracle = ITimeOracle(_timeOracle);
    }

    function createService(uint256 _fee, uint256 _period) external returns (uint256 serviceId) {
        require(_fee > 0, "Fee must be positive");
        require(_period > 0, "Period must be positive");
        
        serviceId = ++nextServiceId;
        services[serviceId] = Service({
            fee: _fee,
            period: _period,
            owner: msg.sender,
            totalEarnings: 0
        });

        emit ServiceCreated(serviceId, msg.sender, _fee, _period);
        return serviceId;
    }

    function pay(uint256 _serviceId) external payable whenNotPaused nonReentrant {
        _subscribe(msg.sender, _serviceId, msg.value);
    }

    function gift(uint256 _serviceId, address _beneficiary) external payable whenNotPaused nonReentrant {
        require(_beneficiary != address(0), "Invalid beneficiary");
        _subscribe(_beneficiary, _serviceId, msg.value);
    }

    function _subscribe(address _subscriber, uint256 _serviceId, uint256 _value) internal {
        Service storage service = services[_serviceId];
        require(service.owner != address(0), "Service does not exist");
        require(_value == service.fee, "Incorrect fee");

        uint256 currentTime = timeOracle.getCurrentTime();
        uint256 newExpiry = subscriptions[_serviceId][_subscriber].expiry > currentTime 
            ? subscriptions[_serviceId][_subscriber].expiry + service.period
            : currentTime + service.period;

        subscriptions[_serviceId][_subscriber] = Subscription({
            expiry: newExpiry,
            active: true,
            renewalFlagged: false,
            lowBalanceFlagged: false
        });

        service.totalEarnings += _value;
        emit SubscriptionPaid(_subscriber, _serviceId, newExpiry);
    }

    function isActive(uint256 _serviceId, address _subscriber) external view returns (bool) {
        Subscription memory sub = subscriptions[_serviceId][_subscriber];
        return sub.active && sub.expiry > timeOracle.getCurrentTime();
    }

    function getServiceStatusSnapshot(uint256 _serviceId) 
        external view returns (address[] memory, bool[] memory, uint256[] memory) 
    {
        uint256 currentTime = timeOracle.getCurrentTime();
        address[] storage subscriberList = serviceSubscribers[_serviceId];
        
        address[] memory subscribers = new address[](subscriberList.length);
        bool[] memory activeStatus = new bool[](subscriberList.length);
        uint256[] memory remainingDays = new uint256[](subscriberList.length);
        
        for (uint256 i = 0; i < subscriberList.length; i++) {
            address subscriber = subscriberList[i];  // NO CAST NEEDED
            Subscription memory sub = subscriptions[_serviceId][subscriber];
            
            subscribers[i] = subscriber;
            activeStatus[i] = sub.active && sub.expiry > currentTime;
            remainingDays[i] = sub.expiry > currentTime ? (sub.expiry - currentTime) / 1 days : 0;
        }
        
        return (subscribers, activeStatus, remainingDays);
    }
    function flagRenewalNeeded(uint256 _serviceId, address _subscriber, bool _needsRenewal, bool _lowBalance) external {
        require(hasRole(KEEPER_ROLE, msg.sender), "Only keeper");
        require(services[_serviceId].owner != address(0), "Service does not exist");

        Subscription storage sub = subscriptions[_serviceId][_subscriber];
        require(sub.active, "Not active subscriber");

        sub.renewalFlagged = _needsRenewal;
        sub.lowBalanceFlagged = _lowBalance;

        emit RenewalFlagged(_serviceId, _subscriber, _lowBalance);
    }

    function withdrawEarnings(uint256 _serviceId) external nonReentrant {
        Service storage service = services[_serviceId];
        require(service.owner == msg.sender, "Not service owner");

        uint256 amount = service.totalEarnings;
        require(amount > 0, "No earnings to withdraw");

        service.totalEarnings = 0;
        payable(msg.sender).transfer(amount);

        emit EarningsWithdrawn(msg.sender, _serviceId, amount);
    }

    function getCollectedEarnings(uint256 _serviceId) external view returns (uint256) {
        return services[_serviceId].totalEarnings;
    }

    function getEndDate(uint256 _serviceId, address _subscriber) external view returns (uint256) {
        return subscriptions[_serviceId][_subscriber].expiry;
    }

    function sweepFees() external {
        require(hasRole(KEEPER_ROLE, msg.sender), "Only keeper");
        require(address(this).balance >= MIN_SWEEP_THRESHOLD, "Below minimum sweep threshold");

        uint256 amount = address(this).balance;
        payable(owner).transfer(amount);

        emit FeesSwept(amount);
    }

    function changeFee(uint256 _serviceId, uint256 _newFee) external {
        require(services[_serviceId].owner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        require(_newFee > 0, "Fee must be positive");
        
        services[_serviceId].fee = _newFee;
    }


    function pause(uint256 _serviceId) external {
        require(services[_serviceId].owner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        _pause();
    }

    function resume(uint256 _serviceId) external {
        require(services[_serviceId].owner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        _unpause();
    }
}
