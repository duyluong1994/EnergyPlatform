#include <eosio/eosio.hpp>
#include <vector>

using namespace eosio;

// POWER CONSTANTS
uint8_t P_1_MW = 1;
uint8_t P_5_MW = 5;
uint8_t P_10_MW = 10;
uint8_t P_20_MW = 20;

std::vector<uint8_t> allowed_power{P_1_MW, P_5_MW, P_10_MW, P_20_MW};

// CERTIFICATE STATE CONSTANTS
uint8_t S_IDLE = 0;
uint8_t S_OWNED = 1;
uint8_t S_MARKED_FOR_SALE = 2;

class [[eosio::contract("greenmarket")]] greenmarket : public contract
{

private:
    struct [[eosio::table]] certificate
    {
        uint64_t id;
        uint8_t covered_power;
        name current_owner;
        uint8_t current_state;

        uint64_t primary_key() const { return id; }
        uint64_t get_owner() const { return current_owner.value; }
    };

    struct [[eosio::table]] purchase
    {
        uint64_t id;
        uint64_t certificate_id;
        name purchaser;

        uint64_t primary_key() const { return id; }
        uint64_t get_cert_id() const { return certificate_id; }
    };

    typedef eosio::multi_index<"certificates"_n, certificate, indexed_by<"byowner"_n, const_mem_fun<certificate, uint64_t, &certificate::get_owner>>> certificates;
    typedef eosio::multi_index<"purchases"_n, purchase, indexed_by<"bycertid"_n, const_mem_fun<purchase, uint64_t, &purchase::get_cert_id>>> purchases;

    bool is_allowed_power(uint8_t power)
    {
        auto result = std::find(allowed_power.begin(), allowed_power.end(), power);
        return *result == power;
    }

public:
    greenmarket(name receiver, name code, datastream<const char *> ds) : contract(receiver, code, ds) {}

    [[eosio::action]] void mint(uint8_t power)
    {
        require_auth(_self);
        check(is_allowed_power(power), "available values is 0, 1, 2");

        certificates _certificates(_self, _self.value);
        _certificates.emplace(_self, [&](auto &row) {
            row.id = _certificates.available_primary_key();
            row.covered_power = power;
            row.current_owner = name();
            row.current_state = S_IDLE;
        });
    }

    [[eosio::action]] void sale(name user, uint64_t certificate_id)
    {
        check(is_account(user), "account does not exist");
        require_auth(user);

        certificates _certificates(_self, _self.value);
        auto iterator = _certificates.find(certificate_id);
        check(iterator != _certificates.end(), "certificate with given id does not exist");
        check(user.value == (*iterator).current_owner.value, "you are not owner of this sertificate");
        _certificates.modify(iterator, user, [&](auto &row) {
            row.current_state = S_MARKED_FOR_SALE;
        });
    }

    [[eosio::action]] void send(name user, uint64_t certificate_id)
    {
        require_auth(_self);
        check(_self != user, "cannot transfer to self");
        check(is_account(user), "account does not exist");

        certificates _certificates(_self, _self.value);
        auto certIterator = _certificates.find(certificate_id);
        check(certIterator != _certificates.end(), "certificate with given id does not exist");
        _certificates.modify(certIterator, _self, [&](auto &row) {
            row.current_owner = user;
            row.current_state = S_OWNED;
        });

        purchases _purchases(_self, _self.value);
        _purchases.emplace(_self, [&](auto &row) {
            row.id = _purchases.available_primary_key();
            row.certificate_id = (*certIterator).id;
            row.purchaser = user;
        });
    }
};

EOSIO_DISPATCH(greenmarket, (mint)(sale)(send))