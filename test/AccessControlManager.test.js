const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Access Control Manager", function () {
  let manager;
  let owner;
  let addr1;
  let ceoRole;
  let revokeRoleError;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    const accessControl = await ethers.getContractFactory(
      "AccessControlManager"
    );
    manager = await accessControl.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await manager.deployed();

    ceoRole = await manager.CEO_ROLE.call();
    revokeRoleError = await manager.REVOKE_ROLE_ERROR.call();
  });

  it("Unable to revoke a role if only one associated address remained", async function () {
    await expect(manager.revokeRole(ceoRole, owner.address)).to.be.revertedWith(
      revokeRoleError
    );
  });

  it("Unable to renounce a role if only one associated address remained", async function () {
    await expect(manager.grantRole(ceoRole, addr1.address))
      .to.emit(manager, "RoleGranted")
      .withArgs(ceoRole, addr1.address, owner.address);
    await expect(manager.renounceRole(ceoRole, owner.address))
      .to.emit(manager, "RoleRevoked")
      .withArgs(ceoRole, owner.address, owner.address);
    await expect(
      manager.connect(addr1).renounceRole(ceoRole, addr1.address)
    ).to.be.revertedWith(revokeRoleError);
  });

  it("The owner can grant a role to another address and then revoke it", async function () {
    await expect(manager.grantRole(ceoRole, addr1.address))
      .to.emit(manager, "RoleGranted")
      .withArgs(ceoRole, addr1.address, owner.address);

    await expect(manager.revokeRole(ceoRole, addr1.address))
      .to.emit(manager, "RoleRevoked")
      .withArgs(ceoRole, addr1.address, owner.address);
  });

  it("A user can renounce its role", async function () {
    await expect(manager.grantRole(ceoRole, addr1.address))
      .to.emit(manager, "RoleGranted")
      .withArgs(ceoRole, addr1.address, owner.address);

    await expect(manager.connect(addr1).renounceRole(ceoRole, addr1.address))
      .to.emit(manager, "RoleRevoked")
      .withArgs(ceoRole, addr1.address, addr1.address);
  });
});
