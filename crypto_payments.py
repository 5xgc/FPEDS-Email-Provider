"""Small, server-side crypto quote and public-chain verification helpers.

These checks query public blockchain data services. They never receive mailbox
credentials, but can see the wallet addresses being queried.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from typing import Any


class PaymentProviderError(RuntimeError):
    """A quote or chain-data provider could not safely verify a request."""


ASSETS = {
    "BTC": {"precision": 8, "confirmations": 1, "price_symbol": "BTC"},
    "SOL": {"precision": 9, "confirmations": 1, "price_symbol": "SOL"},
    "ETH": {"precision": 18, "confirmations": 12, "price_symbol": "ETH"},
    "LTC": {"precision": 8, "confirmations": 6, "price_symbol": "LTC"},
}

BTC_XPUB = "xpub6CAfcjKjJcv6FMXLHUewVrq5CycAa4LRL8o4NiTSAzcS5bRZynrsMC3ZAkJyXo1x6SwDB9dd6Ww2mxRpxhDXKp77MR2NKLvzyErkxiBnGb2"
LTC_XPUB = "xpub6CUsG9Dp6MXgZS9wh2ddcnPd6FD6afWbvvq4MtG1kGsSUZgsSBcJH6qeEY4qtuvjW7vFKJvqKhuvKziDF6gujf3veJZB8o7kSZfH4dGXZyo"
ETH_ADDRESS = "0x2C7df5fc650C0F0B3316B3cf797Ba1A3b288801E"
SOL_ADDRESS = "DGPN2rfE2S84rAjN7oPJiJE6vBkikTDPixrUWYooRdYw"

_BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_CURVE_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
_CURVE_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
_CURVE_G = (
    0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
    0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8,
)


def _request_json(url: str, body: dict[str, Any] | None = None) -> Any:
    payload = json.dumps(body).encode() if body is not None else None
    headers = {"User-Agent": "MoralTown/1.0", "Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                raise PaymentProviderError("Payment provider response was too large.")
            return json.loads(raw.decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PaymentProviderError("A public payment data provider is temporarily unavailable.") from exc


def spot_usd(currency: str) -> Decimal:
    asset = ASSETS.get(currency)
    if not asset:
        raise PaymentProviderError("Unsupported payment currency.")
    url = f"https://api.coinbase.com/v2/prices/{asset['price_symbol']}-USD/spot"
    data = _request_json(url)
    try:
        price = Decimal(str(data["data"]["amount"]))
    except (KeyError, InvalidOperation, TypeError) as exc:
        raise PaymentProviderError("The current exchange rate could not be read.") from exc
    if not price.is_finite() or price <= 0:
        raise PaymentProviderError("The current exchange rate is invalid.")
    return price


def amount_units_for_usd(currency: str, usd_amount: Decimal, spot: Decimal) -> int:
    asset = ASSETS[currency]
    scale = 10 ** asset["precision"]
    return int((usd_amount / spot * scale).to_integral_value(rounding=ROUND_CEILING))


def format_units(currency: str, amount_units: int) -> str:
    precision = ASSETS[currency]["precision"]
    value = Decimal(amount_units) / (10 ** precision)
    return f"{value:.{precision}f}"


def _b58decode(value: str) -> bytes:
    number = 0
    try:
        for character in value:
            number = number * 58 + _BASE58.index(character)
    except ValueError as exc:
        raise PaymentProviderError("The configured extended public key is invalid.") from exc
    decoded = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\0" * (len(value) - len(value.lstrip("1"))) + decoded


def _b58encode(value: bytes) -> str:
    number = int.from_bytes(value, "big")
    result = ""
    while number:
        number, digit = divmod(number, 58)
        result = _BASE58[digit] + result
    return "1" * (len(value) - len(value.lstrip(b"\0"))) + (result or "")


def _b58check(payload: bytes) -> str:
    checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    return _b58encode(payload + checksum)


def _decompress_public_key(key: bytes) -> tuple[int, int]:
    if len(key) != 33 or key[0] not in (2, 3):
        raise PaymentProviderError("The configured extended public key is invalid.")
    x = int.from_bytes(key[1:], "big")
    y_squared = (pow(x, 3, _CURVE_P) + 7) % _CURVE_P
    y = pow(y_squared, (_CURVE_P + 1) // 4, _CURVE_P)
    if y * y % _CURVE_P != y_squared:
        raise PaymentProviderError("The configured extended public key is invalid.")
    if y & 1 != key[0] & 1:
        y = _CURVE_P - y
    return x, y


def _compress_public_key(point: tuple[int, int]) -> bytes:
    x, y = point
    return bytes([2 | (y & 1)]) + x.to_bytes(32, "big")


def _point_add(
    left: tuple[int, int] | None, right: tuple[int, int] | None
) -> tuple[int, int] | None:
    if left is None:
        return right
    if right is None:
        return left
    x1, y1 = left
    x2, y2 = right
    if x1 == x2 and (y1 + y2) % _CURVE_P == 0:
        return None
    if left == right:
        slope = (3 * x1 * x1) * pow(2 * y1, -1, _CURVE_P) % _CURVE_P
    else:
        slope = (y2 - y1) * pow(x2 - x1, -1, _CURVE_P) % _CURVE_P
    x3 = (slope * slope - x1 - x2) % _CURVE_P
    return x3, (slope * (x1 - x3) - y1) % _CURVE_P


def _point_multiply(scalar: int, point: tuple[int, int]) -> tuple[int, int] | None:
    result = None
    addend: tuple[int, int] | None = point
    while scalar:
        if scalar & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        scalar >>= 1
    return result


def _derive_pubkey(account_xpub: str, branch: int, index: int) -> bytes:
    decoded = _b58decode(account_xpub)
    if len(decoded) != 82:
        raise PaymentProviderError("The configured extended public key is invalid.")
    payload, checksum = decoded[:-4], decoded[-4:]
    if hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4] != checksum:
        raise PaymentProviderError("The configured extended public key is invalid.")
    if payload[:4] != bytes.fromhex("0488b21e") or payload[4] == 0:
        raise PaymentProviderError("The configured extended public key has an unsupported format.")
    chain_code = payload[13:45]
    public_key = payload[45:78]
    parent_point = _decompress_public_key(public_key)
    for child_index in (branch, index):
        if not 0 <= child_index < 0x80000000:
            raise PaymentProviderError("The configured wallet derivation index is invalid.")
        digest = hmac.new(chain_code, public_key + child_index.to_bytes(4, "big"), hashlib.sha512).digest()
        left = int.from_bytes(digest[:32], "big")
        if left >= _CURVE_N:
            raise PaymentProviderError("The configured wallet derivation index is invalid.")
        child_point = _point_add(_point_multiply(left, _CURVE_G), parent_point)
        if child_point is None:
            raise PaymentProviderError("The configured wallet derivation index is invalid.")
        public_key = _compress_public_key(child_point)
        parent_point = child_point
        chain_code = digest[32:]
    return public_key


def _convert_bits(data: bytes, from_bits: int, to_bits: int, pad: bool) -> list[int]:
    accumulator = 0
    bits = 0
    result = []
    max_value = (1 << to_bits) - 1
    for value in data:
        if value < 0 or value >> from_bits:
            raise PaymentProviderError("Could not encode the derived wallet address.")
        accumulator = (accumulator << from_bits) | value
        bits += from_bits
        while bits >= to_bits:
            bits -= to_bits
            result.append((accumulator >> bits) & max_value)
    if pad and bits:
        result.append((accumulator << (to_bits - bits)) & max_value)
    elif bits >= from_bits or ((accumulator << (to_bits - bits)) & max_value):
        raise PaymentProviderError("Could not encode the derived wallet address.")
    return result


def _bech32_polymod(values: list[int]) -> int:
    generators = (0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)
    checksum = 1
    for value in values:
        top = checksum >> 25
        checksum = ((checksum & 0x1FFFFFF) << 5) ^ value
        for index, generator in enumerate(generators):
            if (top >> index) & 1:
                checksum ^= generator
    return checksum


def _bech32_address(hrp: str, witness_program: bytes) -> str:
    data = [0] + _convert_bits(witness_program, 8, 5, True)
    expanded = [ord(character) >> 5 for character in hrp] + [0]
    expanded += [ord(character) & 31 for character in hrp]
    value = _bech32_polymod(expanded + data + [0] * 6) ^ 1
    checksum = [(value >> (5 * (5 - index))) & 31 for index in range(6)]
    return hrp + "1" + "".join(_BECH32[item] for item in data + checksum)


def _p2wpkh_address(currency: str, account_xpub: str, index: int) -> str:
    public_key = _derive_pubkey(account_xpub, branch=0, index=index)
    sha_digest = hashlib.sha256(public_key).digest()
    try:
        program = hashlib.new("ripemd160", sha_digest).digest()
    except ValueError as exc:
        raise PaymentProviderError("This runtime cannot encode the configured wallet.") from exc
    return _bech32_address("bc" if currency == "BTC" else "ltc", program)


def address_and_start_height(currency: str, derive_index: int) -> tuple[str, int]:
    if currency == "BTC":
        return _p2wpkh_address(currency, BTC_XPUB, derive_index), 0
    if currency == "LTC":
        return _p2wpkh_address(currency, LTC_XPUB, derive_index), 0
    if currency == "ETH":
        result = _rpc("https://ethereum-rpc.publicnode.com", "eth_blockNumber", [])
        return ETH_ADDRESS, int(result, 16)
    if currency == "SOL":
        result = _rpc("https://api.mainnet-beta.solana.com", "getSlot", [{"commitment": "finalized"}])
        return SOL_ADDRESS, int(result)
    raise PaymentProviderError("Unsupported payment currency.")


def _rpc(url: str, method: str, params: list[Any]) -> Any:
    result = _request_json(
        url,
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
    )
    if not isinstance(result, dict) or result.get("error") or "result" not in result:
        raise PaymentProviderError("A public payment data provider is temporarily unavailable.")
    return result["result"]


def _check_utxo_chain(
    currency: str, address: str, expected_units: int
) -> dict[str, Any] | None:
    base = "https://mempool.space/api" if currency == "BTC" else "https://litecoinspace.org/api"
    transactions = _request_json(f"{base}/address/{urllib.parse.quote(address, safe='')}/txs")
    height = int(_request_json(f"{base}/blocks/tip/height"))
    if not isinstance(transactions, list):
        raise PaymentProviderError("The public payment data provider returned an invalid response.")
    matches = []
    for transaction in transactions:
        status = transaction.get("status", {})
        block_height = int(status.get("block_height") or 0)
        confirmations = max(0, height - block_height + 1) if status.get("confirmed") else 0
        for output in transaction.get("vout", []):
            if (
                output.get("scriptpubkey_address") == address
                and int(output.get("value") or 0) == expected_units
            ):
                matches.append(
                    {
                        "txid": transaction.get("txid"),
                        "confirmations": confirmations,
                    }
                )
    if not matches:
        return None
    return max(matches, key=lambda item: item["confirmations"])


def _check_ethereum(
    expected_units: int, start_height: int
) -> dict[str, Any] | None:
    query = urllib.parse.urlencode(
        {
            "module": "account",
            "action": "txlist",
            "address": ETH_ADDRESS,
            "startblock": max(0, start_height),
            "endblock": "latest",
            "page": 1,
            "offset": 100,
            "sort": "desc",
        }
    )
    data = _request_json(
        "https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?" + query
    )
    rows = data.get("result", []) if isinstance(data, dict) else []
    if isinstance(rows, str) and "no transactions" in rows.lower():
        return None
    if not isinstance(rows, list):
        raise PaymentProviderError("The public payment data provider returned an invalid response.")
    latest = int(_rpc("https://ethereum-rpc.publicnode.com", "eth_blockNumber", []), 16)
    matches = []
    for transaction in rows:
        if str(transaction.get("to", "")).lower() != ETH_ADDRESS.lower():
            continue
        try:
            value = int(str(transaction.get("value", "0")), 10)
            block = int(str(transaction.get("blockNumber", "0")), 10)
        except ValueError:
            continue
        if value == expected_units and str(transaction.get("isError", "0")) == "0":
            matches.append(
                {
                    "txid": transaction.get("hash"),
                    "confirmations": max(0, latest - block + 1),
                }
            )
    if not matches:
        return None
    return max(matches, key=lambda item: item["confirmations"])


def _check_solana(
    expected_units: int, start_height: int
) -> dict[str, Any] | None:
    signatures = _rpc(
        "https://api.mainnet-beta.solana.com",
        "getSignaturesForAddress",
        [SOL_ADDRESS, {"commitment": "finalized", "limit": 30}],
    )
    if not isinstance(signatures, list):
        raise PaymentProviderError("The public payment data provider returned an invalid response.")
    for entry in signatures:
        if entry.get("err") is not None or int(entry.get("slot", 0)) < start_height:
            continue
        signature = entry.get("signature")
        if not signature:
            continue
        transaction = _rpc(
            "https://api.mainnet-beta.solana.com",
            "getTransaction",
            [signature, {"encoding": "jsonParsed", "commitment": "finalized", "maxSupportedTransactionVersion": 0}],
        )
        if not isinstance(transaction, dict) or transaction.get("meta", {}).get("err") is not None:
            continue
        message = transaction.get("transaction", {}).get("message", {})
        instructions = message.get("instructions", [])
        for instruction in instructions:
            parsed = instruction.get("parsed", {})
            info = parsed.get("info", {}) if isinstance(parsed, dict) else {}
            if (
                parsed.get("type") == "transfer"
                and info.get("destination") == SOL_ADDRESS
                and int(info.get("lamports", 0)) == expected_units
            ):
                return {"txid": signature, "confirmations": 1}
    return None


def find_payment(
    currency: str,
    address: str,
    expected_units: int,
    start_height: int,
) -> dict[str, Any] | None:
    if currency in ("BTC", "LTC"):
        return _check_utxo_chain(currency, address, expected_units)
    if currency == "ETH":
        return _check_ethereum(expected_units, start_height)
    if currency == "SOL":
        return _check_solana(expected_units, start_height)
    raise PaymentProviderError("Unsupported payment currency.")


def purchase_proof(order_id: str, transaction_id: str, secret: str) -> str:
    signature = hmac.new(
        secret.encode("utf-8"),
        f"moraltown-paid:{order_id}:{transaction_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{order_id}.{signature}"


def valid_purchase_proof(
    proof: str, order_id: str, transaction_id: str, secret: str
) -> bool:
    return hmac.compare_digest(
        proof,
        purchase_proof(order_id, transaction_id, secret),
    )