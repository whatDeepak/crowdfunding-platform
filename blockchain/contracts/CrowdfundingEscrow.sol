// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CrowdfundingEscrow
 * @dev Escrow-based crowdfunding with admin-controlled milestone releases.
 *      Funds are held until the platform admin approves a withdrawal request
 *      backed by IPFS-stored proof. Every approval is permanently on-chain.
 */
contract CrowdfundingEscrow {
    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum CampaignStatus  { Active, Funded, Completed, Cancelled }
    enum RequestStatus   { Pending, Approved, Rejected }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Campaign {
        uint256 id;
        address payable creator;
        uint256 targetAmount;
        uint256 amountRaised;
        uint256 deadline;
        CampaignStatus status;
        string ipfsMetadataHash; // IPFS CID of campaign docs uploaded at creation
        uint256 createdAt;
    }

    struct WithdrawalRequest {
        uint256 id;
        uint256 campaignId;
        uint256 requestedAmount;
        string proofIpfsHash;    // IPFS CID of proof documents (invoice, receipt, etc.)
        RequestStatus status;
        string rejectionReason;
        uint256 createdAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    address public admin;
    uint256 public platformFeePercent = 2;   // 2% taken on each approved release
    uint256 public platformFeesCollected;
    uint256 public campaignCounter;

    mapping(uint256 => Campaign) public campaigns;

    // Donor-level tracking
    mapping(uint256 => address[]) private _campaignDonors;
    mapping(uint256 => uint256[]) private _campaignDonationAmounts;
    mapping(uint256 => mapping(address => uint256)) public donorContributions;

    // Withdrawal requests per campaign
    mapping(uint256 => WithdrawalRequest[]) private _withdrawalRequests;

    // Creator → campaign IDs
    mapping(address => uint256[]) public creatorCampaigns;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        uint256 targetAmount,
        uint256 deadline,
        string ipfsMetadataHash
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        uint256 timestamp
    );

    event WithdrawalRequested(
        uint256 indexed campaignId,
        uint256 indexed requestId,
        uint256 requestedAmount,
        string proofIpfsHash
    );

    event WithdrawalApproved(
        uint256 indexed campaignId,
        uint256 indexed requestId,
        address indexed creator,
        uint256 amountReleased,
        uint256 platformFee
    );

    event WithdrawalRejected(
        uint256 indexed campaignId,
        uint256 indexed requestId,
        string reason
    );

    event CampaignCancelled(uint256 indexed campaignId);

    event DonorRefunded(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        require(campaignId > 0 && campaignId <= campaignCounter, "Campaign does not exist");
        _;
    }

    modifier onlyCreator(uint256 campaignId) {
        require(campaigns[campaignId].creator == msg.sender, "Not campaign creator");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Campaign lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Create a new campaign. The creator's wallet address is the beneficiary.
     * @param targetAmount  Fundraising goal in wei
     * @param durationDays  Campaign duration in days
     * @param ipfsHash      IPFS CID of the campaign metadata/document bundle
     */
    function createCampaign(
        uint256 targetAmount,
        uint256 durationDays,
        string calldata ipfsHash
    ) external returns (uint256) {
        require(targetAmount > 0, "Target must be > 0");
        require(durationDays > 0 && durationDays <= 365, "Duration: 1-365 days");

        campaignCounter++;
        uint256 id = campaignCounter;
        uint256 deadline = block.timestamp + (durationDays * 1 days);

        campaigns[id] = Campaign({
            id: id,
            creator: payable(msg.sender),
            targetAmount: targetAmount,
            amountRaised: 0,
            deadline: deadline,
            status: CampaignStatus.Active,
            ipfsMetadataHash: ipfsHash,
            createdAt: block.timestamp
        });

        creatorCampaigns[msg.sender].push(id);

        emit CampaignCreated(id, msg.sender, targetAmount, deadline, ipfsHash);
        return id;
    }

    /**
     * @dev Donate ETH to a campaign. Funds are held in this contract (escrow).
     */
    function donate(uint256 campaignId) external payable campaignExists(campaignId) {
        require(msg.value > 0, "Donation must be > 0");

        Campaign storage c = campaigns[campaignId];
        require(
            c.status == CampaignStatus.Active || c.status == CampaignStatus.Funded,
            "Campaign not accepting donations"
        );
        require(block.timestamp <= c.deadline, "Campaign deadline passed");

        c.amountRaised += msg.value;
        donorContributions[campaignId][msg.sender] += msg.value;
        _campaignDonors[campaignId].push(msg.sender);
        _campaignDonationAmounts[campaignId].push(msg.value);

        if (c.amountRaised >= c.targetAmount) {
            c.status = CampaignStatus.Funded;
        }

        emit DonationReceived(campaignId, msg.sender, msg.value, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Withdrawal requests (creator)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Creator submits a withdrawal request with proof of milestone completion.
     * @param campaignId      Campaign to withdraw from
     * @param requestedAmount Amount in wei being requested
     * @param proofIpfsHash   IPFS CID of proof bundle (invoice, receipt, photo)
     */
    function submitWithdrawalRequest(
        uint256 campaignId,
        uint256 requestedAmount,
        string calldata proofIpfsHash
    ) external campaignExists(campaignId) onlyCreator(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(
            c.status == CampaignStatus.Active || c.status == CampaignStatus.Funded,
            "Campaign not eligible for withdrawal"
        );
        require(requestedAmount > 0, "Amount must be > 0");
        require(requestedAmount <= c.amountRaised, "Insufficient campaign balance");
        require(bytes(proofIpfsHash).length > 0, "Proof hash required");

        uint256 requestId = _withdrawalRequests[campaignId].length;

        _withdrawalRequests[campaignId].push(WithdrawalRequest({
            id: requestId,
            campaignId: campaignId,
            requestedAmount: requestedAmount,
            proofIpfsHash: proofIpfsHash,
            status: RequestStatus.Pending,
            rejectionReason: "",
            createdAt: block.timestamp
        }));

        emit WithdrawalRequested(campaignId, requestId, requestedAmount, proofIpfsHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin: approve / reject withdrawals
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Approve a withdrawal request. Releases ETH to the creator minus
     *      the platform fee.
     */
    function approveWithdrawal(
        uint256 campaignId,
        uint256 requestId
    ) external onlyAdmin campaignExists(campaignId) {
        WithdrawalRequest storage req = _withdrawalRequests[campaignId][requestId];
        require(req.status == RequestStatus.Pending, "Request not pending");

        Campaign storage c = campaigns[campaignId];
        require(req.requestedAmount <= c.amountRaised, "Insufficient campaign balance");

        uint256 fee = (req.requestedAmount * platformFeePercent) / 100;
        uint256 payout = req.requestedAmount - fee;

        req.status = RequestStatus.Approved;
        c.amountRaised -= req.requestedAmount;
        platformFeesCollected += fee;

        (bool ok, ) = c.creator.call{value: payout}("");
        require(ok, "Transfer to creator failed");

        emit WithdrawalApproved(campaignId, requestId, c.creator, payout, fee);
    }

    /**
     * @dev Reject a withdrawal request with a reason (shown to creator in UI).
     */
    function rejectWithdrawal(
        uint256 campaignId,
        uint256 requestId,
        string calldata reason
    ) external onlyAdmin campaignExists(campaignId) {
        WithdrawalRequest storage req = _withdrawalRequests[campaignId][requestId];
        require(req.status == RequestStatus.Pending, "Request not pending");

        req.status = RequestStatus.Rejected;
        req.rejectionReason = reason;

        emit WithdrawalRejected(campaignId, requestId, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin: cancel campaign
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Admin cancels a campaign. Enables permissionless donor refunds.
     */
    function cancelCampaign(uint256 campaignId) external onlyAdmin campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(c.status != CampaignStatus.Cancelled, "Already cancelled");
        c.status = CampaignStatus.Cancelled;
        emit CampaignCancelled(campaignId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Donor: claim refund
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Any donor can claim their refund when:
     *      (a) campaign is cancelled, OR
     *      (b) deadline passed and target was never reached.
     */
    function claimRefund(uint256 campaignId) external campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];
        bool deadlineMissed = block.timestamp > c.deadline &&
                              c.amountRaised < c.targetAmount &&
                              c.status == CampaignStatus.Active;
        bool cancelled = c.status == CampaignStatus.Cancelled;

        require(deadlineMissed || cancelled, "Refund not available");

        uint256 contribution = donorContributions[campaignId][msg.sender];
        require(contribution > 0, "No contribution to refund");

        donorContributions[campaignId][msg.sender] = 0;
        c.amountRaised -= contribution;

        if (deadlineMissed) {
            c.status = CampaignStatus.Cancelled;
        }

        (bool ok, ) = payable(msg.sender).call{value: contribution}("");
        require(ok, "Refund transfer failed");

        emit DonorRefunded(campaignId, msg.sender, contribution);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin: collect platform fees
    // ─────────────────────────────────────────────────────────────────────────

    function withdrawPlatformFees() external onlyAdmin {
        uint256 amount = platformFeesCollected;
        require(amount > 0, "No fees to withdraw");
        platformFeesCollected = 0;
        (bool ok, ) = payable(admin).call{value: amount}("");
        require(ok, "Fee withdrawal failed");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    function getCampaign(uint256 campaignId)
        external view campaignExists(campaignId)
        returns (Campaign memory)
    {
        return campaigns[campaignId];
    }

    function getCampaignDonors(uint256 campaignId)
        external view campaignExists(campaignId)
        returns (address[] memory donors, uint256[] memory amounts)
    {
        return (_campaignDonors[campaignId], _campaignDonationAmounts[campaignId]);
    }

    function getWithdrawalRequests(uint256 campaignId)
        external view campaignExists(campaignId)
        returns (WithdrawalRequest[] memory)
    {
        return _withdrawalRequests[campaignId];
    }

    function getCreatorCampaigns(address creator)
        external view
        returns (uint256[] memory)
    {
        return creatorCampaigns[creator];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
