// created by Duy Luong at 2020/05/12 23:07.
// - Blockchain Developer -
// Mail: duyluong1994@gmail.com
// Telegram: t.me/mr_eos94

const TOKEN_WASM_PATH = "./contracts/energyplatform/certificates.wasm";
const TOKEN_ABI_PATH = "./contracts/energyplatform/certificates.abi";

let deploy = async function (eoslime, deployer) {
  if (!deployer) {
    deployer = await eoslime.Account.createRandom();
  }

  let testContract = await eoslime.Contract.deployOnAccount(
    TOKEN_WASM_PATH,
    TOKEN_ABI_PATH,
    deployer
  );
};

module.exports = deploy;
