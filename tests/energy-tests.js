// created by Duy Luong at 2020/05/12 23:07.
// - Blockchain Developer -
// Mail: duyluong1994@gmail.com
// Telegram: t.me/mr_eos94

const assert = require("assert");
const { RpcError } = require("eosjs");

const TOKEN_WASM_PATH = "./contracts/energyplatform/certificates.wasm";
const TOKEN_ABI_PATH = "./contracts/energyplatform/certificates.abi";

describe("Energy Platform Units Test", function (eoslime) {
  // Increase mocha(testing framework) time, otherwise tests fails
  this.timeout(15000);

  let testContract;
  let testUserOwnCert;
  let testUserNoCert;

  let is_allowed_power = [1, 5, 10, 20];
  let invalid_power = [-1, 3, 1.2];

  const invalidCertId = 999999;

  const S_IDLE = 0;
  const S_OWNED = 1;
  const S_MARKED_FOR_SALE = 2;

  before(async () => {
    let accounts = await eoslime.Account.createRandoms(2);
    testUserOwnCert = accounts[0];
    testUserNoCert = accounts[1];
  });

  beforeEach(async () => {
    /*
           `deploy` creates for you a new account behind the scene
           on which the contract code is deployed

           You can access the contract account as -> testContract.executor
       */
    testContract = await eoslime.Contract.deploy(
      TOKEN_WASM_PATH,
      TOKEN_ABI_PATH
    );
  });

  it("Should be able to mint a new certificate", async () => {
    for (let power of is_allowed_power) {
      await testContract.mint(power);
    }
    let certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(-1)
      .find();

    for (let i = 0; i < is_allowed_power.length; i++) {
      assert.equal(
        certs[i].covered_power,
        is_allowed_power[i],
        "Incorrect power value"
      );
      assert.equal(
        certs[i].current_state,
        S_IDLE,
        "Incorrect current_state value"
      );
    }
  });
  it("Should not be able to mint a new certificate with wrong power", async () => {
    for (let power of invalid_power) {
      let r = await testContract
        .mint(power)
        .then((r) => {
          return true;
        })
        .catch((e) => {
          return false;
        });
      assert.equal(r, false, "Should not mint");
    }
  });

  it("Other user except conntract's owner should not be able to mint a new certificate", async () => {
    for (let power of is_allowed_power) {
      let r = await testContract
        .mint(power, { from: testUserNoCert })
        .then((r) => {
          return true;
        })
        .catch((e) => {
          return false;
        });
      assert.equal(r, false, "Should not mint");
    }
  });

  it("Should be able to send a certificate", async () => {
    for (let power of is_allowed_power) {
      await testContract.mint(power);
    }

    let certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(-1)
      .find();

    for (let cert of certs) {
      await testContract.send(testUserOwnCert.name, cert.id);
    }

    certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(-1)
      .find();

    for (let cert of certs) {
      assert.equal(
        cert.current_owner,
        testUserOwnCert.name,
        "Incorrect owner value"
      );
      assert.equal(
        cert.current_state,
        S_OWNED,
        "Incorrect current_state value"
      );
    }

    let purchases = await testContract.provider
      .select("purchases")
      .from(testContract.name)
      .limit(-1)
      .find();

    for (let i = 0; i < certs.length; i++) {
      assert.equal(
        purchases[i].certificate_id,
        certs[i].id,
        "Incorrect certificate_id value"
      );
      assert.equal(
        purchases[i].purchaser,
        certs[i].current_owner,
        "Incorrect purchaser value"
      );
    }
  });

  it("Should not be able to send a certificate with inexistent certs", async () => {
    let r = await testContract
      .send(testUserOwnCert, invalidCertId)
      .then((r) => {
        return true;
      })
      .catch((e) => {
        return false;
      });
    assert.equal(r, false, "Should not send");
  });
  it("Other user except conntract's owner should not be able to send a certificate", async () => {
    await testContract.mint(is_allowed_power[0]);

    let certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(1)
      .find();

    let r = await testContract
      .mint(testUserOwnCert, certs[0].id, { from: testUserNoCert })
      .then((r) => {
        return true;
      })
      .catch((e) => {
        return false;
      });
    assert.equal(r, false, "Should not send");
  });

  it("Cert's owner should be able to send a certificate", async () => {
    await testContract.mint(is_allowed_power[0]);

    let certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(1)
      .find();

    await testContract.send(testUserOwnCert.name, certs[0].id);

    await testContract.sale(testUserOwnCert.name, certs[0].id, {
      from: testUserOwnCert,
    });

    certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(1)
      .find();

    assert.equal(
      certs[0].current_state,
      S_MARKED_FOR_SALE,
      "Incorrect current_state value"
    );
  });

  it("Other user except cert's owner should not be able to sale a certificate", async () => {
    await testContract.mint(is_allowed_power[0]);

    let certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(1)
      .find();

    await testContract.send(testUserOwnCert.name, certs[0].id);

    let r = await testContract
      .sale(testUserNoCert.name, certs[0].id, {
        from: testUserOwnCert,
      })
      .then((r) => {
        return true;
      })
      .catch((e) => {
        return false;
      });

    assert.equal(r, false, "Should not sale");
  });

  it("Should not be able to sale a certificate with inexistent certs ", async () => {
    await testContract.mint(is_allowed_power[0]);

    let certs = await testContract.provider
      .select("certificates")
      .from(testContract.name)
      .limit(1)
      .find();

    await testContract.send(testUserOwnCert.name, certs[0].id);

    let r = await testContract
      .sale(testUserOwnCert.name, invalidCertId, {
        from: testUserOwnCert,
      })
      .then((r) => {
        return true;
      })
      .catch((e) => {
        return false;
      });

    assert.equal(r, false, "Should not sale");
  });
});
