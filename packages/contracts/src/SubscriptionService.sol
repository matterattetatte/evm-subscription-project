// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITimeOracle.sol";

contract SubscriptionService is AccessControl, ReentrancyGuard {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    error ServiceDoesNotExist();
    error ServicePaused();
    error Unauthorized();
    error BelowSweepThreshold();
    error NoEarningsToSweep();
    error IncorrectFee();

    ITimeOracle public immutable timeOracle;

    struct Service {
        uint256 fee;
        uint256 period;
        address owner;
        uint256 totalEarnings;
        bool paused;
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

    modifier whenServiceNotPaused(uint256 _serviceId) {
        if (services[_serviceId].paused) revert ServicePaused();
        _;
    }

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
            totalEarnings: 0,
            paused: false
        });

        emit ServiceCreated(serviceId, msg.sender, _fee, _period);
        return serviceId;
    }

    function pay(uint256 _serviceId) external payable whenServiceNotPaused(_serviceId) nonReentrant {
        _subscribe(msg.sender, _serviceId, msg.value);
    }

    function gift(uint256 _serviceId, address _beneficiary) external payable whenServiceNotPaused(_serviceId) nonReentrant {
        require(_beneficiary != address(0), "Invalid beneficiary");
        _subscribe(_beneficiary, _serviceId, msg.value);
    }

    function _subscribe(address _subscriber, uint256 _serviceId, uint256 _value) internal {
        Service storage service = services[_serviceId];
        assert(service.owner != address(0));
        if (_value < service.fee || _value % service.fee != 0) revert IncorrectFee();
        
        uint256 periods = _value / service.fee;

        address[] storage subscriberList = serviceSubscribers[_serviceId];
        if (!subscriptions[_serviceId][_subscriber].active) {
            subscriberList.push(_subscriber);
        }

        uint256 currentTime = timeOracle.getCurrentTime();
        uint256 newExpiry;
        if (subscriptions[_serviceId][_subscriber].expiry > 0) {
            newExpiry = subscriptions[_serviceId][_subscriber].expiry + service.period * periods;
        } else {
            newExpiry = currentTime + service.period * periods;
        }

        subscriptions[_serviceId][_subscriber] = Subscription({
            expiry: newExpiry,
            active: true,
            renewalFlagged: false,
            lowBalanceFlagged: false
        });

        service.totalEarnings += _value;
        emit SubscriptionPaid(_subscriber, _serviceId, newExpiry);
    }

    receive() external payable {
        revert("Use pay() or gift() to subscribe");
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
            address subscriber = subscriberList[i];
            Subscription memory sub = subscriptions[_serviceId][subscriber];
            
            subscribers[i] = subscriber;
            activeStatus[i] = sub.active && sub.expiry > currentTime;
            remainingDays[i] = sub.expiry > currentTime ? (sub.expiry - currentTime) / 1 days : 0;
        }
        
        return (subscribers, activeStatus, remainingDays);
    }

    function flagRenewalNeeded(uint256 _serviceId, address _subscriber, bool _needsRenewal, bool _lowBalance) external {
        if (!hasRole(KEEPER_ROLE, msg.sender)) revert Unauthorized();
        if (services[_serviceId].owner == address(0)) revert ServiceDoesNotExist();

        Subscription storage sub = subscriptions[_serviceId][_subscriber];
        require(sub.active, "Not active subscriber");

        sub.renewalFlagged = _needsRenewal;
        sub.lowBalanceFlagged = _lowBalance;

        emit RenewalFlagged(_serviceId, _subscriber, _lowBalance);
    }

    function sweepFees() external {
        if (!hasRole(KEEPER_ROLE, msg.sender)) revert Unauthorized();
        if (address(this).balance < MIN_SWEEP_THRESHOLD) revert BelowSweepThreshold();

        uint256 totalSwept = 0;
        uint256 servicesLength = nextServiceId;
        
        for (uint256 i = 1; i <= servicesLength; i++) {
            Service storage service = services[i];
            if (service.owner != address(0) && service.totalEarnings > 0) {
                totalSwept += service.totalEarnings;
                payable(service.owner).transfer(service.totalEarnings);
                service.totalEarnings = 0;
            }
        }
        
        if (totalSwept == 0) revert NoEarningsToSweep();
        emit FeesSwept(totalSwept);
    }

    function getCollectedEarnings(uint256 _serviceId) external view returns (uint256) {
        return services[_serviceId].totalEarnings;
    }

    function getEndDate(uint256 _serviceId, address _subscriber) external view returns (uint256) {
        return subscriptions[_serviceId][_subscriber].expiry;
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

    function changeFee(uint256 _serviceId, uint256 _newFee) external {
        require(services[_serviceId].owner != address(0), "Service does not exist");
        require(services[_serviceId].owner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        require(_newFee > 0, "Fee must be positive");
        
        services[_serviceId].fee = _newFee;
    }

    function pause(uint256 _serviceId) external {
        require(services[_serviceId].owner != address(0), "Service does not exist");
        require(services[_serviceId].owner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        require(!services[_serviceId].paused, "Already paused");
        services[_serviceId].paused = true;
    }

    function resume(uint256 _serviceId) external {
        require(services[_serviceId].owner != address(0), "Service does not exist");
        require(services[_serviceId].owner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        require(services[_serviceId].paused, "Not paused");
        services[_serviceId].paused = false;
    }
}
