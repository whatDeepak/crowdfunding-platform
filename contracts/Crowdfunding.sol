// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CrowdfundingPlatform
 * @dev A decentralized crowdfunding platform with milestone-based fund release
 */
contract CrowdfundingPlatform {
    enum CampaignStatus { Active, Completed, Cancelled, Funded }
    enum MilestoneStatus { Pending, Completed, Verified, Failed }

    struct Campaign {
        uint256 id;
        address creator;
        string title;
        string description;
        uint256 targetAmount;
        uint256 deadline;
        uint256 amountRaised;
        CampaignStatus status;
        string ipfsHash; // IPFS hash for campaign media/details
        uint256 createdAt;
    }

    struct Milestone {
        uint256 id;
        uint256 campaignId;
        string title;
        string description;
        uint256 releaseAmount;
        uint256 deadline;
        MilestoneStatus status;
        uint256 votes;
        uint256 totalVoters;
    }

    struct Donation {
        uint256 id;
        uint256 campaignId;
        address donor;
        uint256 amount;
        uint256 timestamp;
        bool refunded;
    }

    // State variables
    uint256 public campaignCounter = 0;
    uint256 public donationCounter = 0;
    uint256 public platformFeePercentage = 2; // 2% platform fee

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone[]) public campaignMilestones;
    mapping(uint256 => Donation[]) public campaignDonations;
    mapping(uint256 => mapping(address => uint256)) public donorContributions;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public milestoneVotes; // campaignId => milestoneId => voter => hasVoted
    mapping(address => uint256[]) public creatorCampaigns;
    mapping(address => uint256) public creatorWithdrawals;
    
    address public platformOwner;
    uint256 public platformFeesCollected = 0;

    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        string title,
        uint256 targetAmount,
        uint256 deadline
    );

    event DonationMade(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        uint256 timestamp
    );

    event MilestoneCreated(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        string title,
        uint256 releaseAmount
    );

    event MilestoneVoteCast(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address indexed voter,
        bool approved
    );

    event MilestoneVerified(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        uint256 releaseAmount
    );

    event FundsWithdrawn(
        address indexed creator,
        uint256 campaignId,
        uint256 amount
    );

    event CampaignCancelled(
        uint256 indexed campaignId,
        string reason
    );

    event RefundProcessed(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    // Modifiers
    modifier onlyPlatformOwner() {
        require(msg.sender == platformOwner, "Only platform owner can call this");
        _;
    }

    modifier campaignExists(uint256 _campaignId) {
        require(_campaignId > 0 && _campaignId <= campaignCounter, "Campaign does not exist");
        _;
    }

    modifier onlyCreator(uint256 _campaignId) {
        require(campaigns[_campaignId].creator == msg.sender, "Only creator can call this");
        _;
    }

    constructor() {
        platformOwner = msg.sender;
    }

    /**
     * @dev Create a new campaign
     */
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _targetAmount,
        uint256 _durationDays,
        string memory _ipfsHash
    ) external returns (uint256) {
        require(_targetAmount > 0, "Target amount must be greater than 0");
        require(_durationDays > 0, "Duration must be greater than 0");
        
        campaignCounter++;
        uint256 campaignId = campaignCounter;
        uint256 deadline = block.timestamp + (_durationDays * 1 days);

        campaigns[campaignId] = Campaign({
            id: campaignId,
            creator: msg.sender,
            title: _title,
            description: _description,
            targetAmount: _targetAmount,
            deadline: deadline,
            amountRaised: 0,
            status: CampaignStatus.Active,
            ipfsHash: _ipfsHash,
            createdAt: block.timestamp
        });

        creatorCampaigns[msg.sender].push(campaignId);

        emit CampaignCreated(campaignId, msg.sender, _title, _targetAmount, deadline);
        return campaignId;
    }

    /**
     * @dev Donate to a campaign
     */
    function donate(uint256 _campaignId) external payable campaignExists(_campaignId) {
        require(msg.value > 0, "Donation amount must be greater than 0");
        
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.status == CampaignStatus.Active, "Campaign is not active");
        require(block.timestamp <= campaign.deadline, "Campaign deadline has passed");

        donationCounter++;
        campaign.amountRaised += msg.value;
        donorContributions[_campaignId][msg.sender] += msg.value;

        campaignDonations[_campaignId].push(Donation({
            id: donationCounter,
            campaignId: _campaignId,
            donor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            refunded: false
        }));

        // Mark campaign as funded if target is reached
        if (campaign.amountRaised >= campaign.targetAmount) {
            campaign.status = CampaignStatus.Funded;
        }

        emit DonationMade(_campaignId, msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Create a milestone for a campaign
     */
    function createMilestone(
        uint256 _campaignId,
        string memory _title,
        string memory _description,
        uint256 _releaseAmount,
        uint256 _durationDays
    ) external campaignExists(_campaignId) onlyCreator(_campaignId) {
        require(_releaseAmount > 0, "Release amount must be greater than 0");
        require(_durationDays > 0, "Duration must be greater than 0");

        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.status == CampaignStatus.Funded, "Campaign must be funded");

        Milestone memory newMilestone = Milestone({
            id: campaignMilestones[_campaignId].length,
            campaignId: _campaignId,
            title: _title,
            description: _description,
            releaseAmount: _releaseAmount,
            deadline: block.timestamp + (_durationDays * 1 days),
            status: MilestoneStatus.Pending,
            votes: 0,
            totalVoters: 0
        });

        campaignMilestones[_campaignId].push(newMilestone);

        emit MilestoneCreated(_campaignId, newMilestone.id, _title, _releaseAmount);
    }

    /**
     * @dev Vote on milestone completion
     */
    function voteMilestone(
        uint256 _campaignId,
        uint256 _milestoneId,
        bool _approve
    ) external campaignExists(_campaignId) {
        require(_milestoneId < campaignMilestones[_campaignId].length, "Milestone does not exist");
        require(donorContributions[_campaignId][msg.sender] > 0, "Must be a donor to vote");
        require(!milestoneVotes[_campaignId][_milestoneId][msg.sender], "Already voted");

        Milestone storage milestone = campaignMilestones[_campaignId][_milestoneId];
        require(milestone.status == MilestoneStatus.Pending, "Milestone is not pending");

        milestoneVotes[_campaignId][_milestoneId][msg.sender] = true;
        milestone.totalVoters++;

        if (_approve) {
            milestone.votes++;
        }

        // Auto-verify if 80% of donors approve
        if (milestone.votes > (campaignDonations[_campaignId].length * 80 / 100)) {
            milestone.status = MilestoneStatus.Verified;
            emit MilestoneVerified(_campaignId, _milestoneId, milestone.releaseAmount);
        }

        emit MilestoneVoteCast(_campaignId, _milestoneId, msg.sender, _approve);
    }

    /**
     * @dev Withdraw funds for verified milestone
     */
    function withdrawMilestoneFunds(
        uint256 _campaignId,
        uint256 _milestoneId
    ) external campaignExists(_campaignId) onlyCreator(_campaignId) {
        require(_milestoneId < campaignMilestones[_campaignId].length, "Milestone does not exist");

        Milestone storage milestone = campaignMilestones[_campaignId][_milestoneId];
        require(milestone.status == MilestoneStatus.Verified, "Milestone not verified");

        Campaign storage campaign = campaigns[_campaignId];
        uint256 platformFee = (milestone.releaseAmount * platformFeePercentage) / 100;
        uint256 creatorAmount = milestone.releaseAmount - platformFee;

        milestone.status = MilestoneStatus.Completed;
        platformFeesCollected += platformFee;
        creatorWithdrawals[msg.sender] += creatorAmount;

        (bool success, ) = msg.sender.call{value: creatorAmount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(msg.sender, _campaignId, creatorAmount);
    }

    /**
     * @dev Cancel campaign and refund donors
     */
    function cancelCampaign(uint256 _campaignId) external campaignExists(_campaignId) onlyCreator(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.status != CampaignStatus.Cancelled, "Campaign already cancelled");

        campaign.status = CampaignStatus.Cancelled;

        // Refund all donors
        Donation[] storage donations = campaignDonations[_campaignId];
        for (uint256 i = 0; i < donations.length; i++) {
            if (!donations[i].refunded) {
                donations[i].refunded = true;
                (bool success, ) = donations[i].donor.call{value: donations[i].amount}("");
                require(success, "Refund failed");
                emit RefundProcessed(_campaignId, donations[i].donor, donations[i].amount);
            }
        }

        emit CampaignCancelled(_campaignId, "Campaign cancelled by creator");
    }

    /**
     * @dev Refund donors if campaign deadline passed without funding
     */
    function refundDonors(uint256 _campaignId) external campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp > campaign.deadline, "Campaign still active");
        require(campaign.status == CampaignStatus.Active, "Campaign not active");
        require(campaign.amountRaised < campaign.targetAmount, "Campaign was funded");

        campaign.status = CampaignStatus.Cancelled;

        Donation[] storage donations = campaignDonations[_campaignId];
        for (uint256 i = 0; i < donations.length; i++) {
            if (!donations[i].refunded) {
                donations[i].refunded = true;
                (bool success, ) = donations[i].donor.call{value: donations[i].amount}("");
                require(success, "Refund failed");
                emit RefundProcessed(_campaignId, donations[i].donor, donations[i].amount);
            }
        }
    }

    /**
     * @dev Withdraw platform fees
     */
    function withdrawPlatformFees() external onlyPlatformOwner {
        uint256 amount = platformFeesCollected;
        platformFeesCollected = 0;
        (bool success, ) = platformOwner.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Get campaign details
     */
    function getCampaign(uint256 _campaignId) external view campaignExists(_campaignId) returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    /**
     * @dev Get campaign milestones
     */
    function getCampaignMilestones(uint256 _campaignId) external view campaignExists(_campaignId) returns (Milestone[] memory) {
        return campaignMilestones[_campaignId];
    }

    /**
     * @dev Get campaign donations
     */
    function getCampaignDonations(uint256 _campaignId) external view campaignExists(_campaignId) returns (Donation[] memory) {
        return campaignDonations[_campaignId];
    }

    /**
     * @dev Get creator's campaigns
     */
    function getCreatorCampaigns(address _creator) external view returns (uint256[] memory) {
        return creatorCampaigns[_creator];
    }
}
