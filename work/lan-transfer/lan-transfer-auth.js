(function () {
  const authKey = "xyx-lan-transfer-auth-v1";
  const config = window.XYX_LAN_TRANSFER_AUTH || {};

  function clearAuthGate() {
    document.documentElement.classList.remove("lan-auth-pending");
  }

  function blockPage(message) {
    alert(message);
    window.XYX_LAN_TRANSFER_AUTH_BLOCKED = true;

    const renderBlockedPage = () => {
      document.title = "访问受限";
      document.body.innerHTML = [
        "<main style=\"min-height:100vh;display:grid;place-items:center;background:#101418;color:#f4f7fb;font-family:system-ui,sans-serif;\">",
        "<section style=\"max-width:520px;padding:24px;text-align:center;line-height:1.7;\">",
        "<h1 style=\"margin:0 0 12px;font-size:28px;\">访问受限</h1>",
        "<p style=\"margin:0;color:rgba(244,247,251,.72);\">请刷新页面后输入正确账户密码。</p>",
        "</section>",
        "</main>",
      ].join("");
      document.documentElement.classList.remove("lan-auth-pending");
    };

    if (document.body) {
      renderBlockedPage();
    } else {
      document.addEventListener("DOMContentLoaded", renderBlockedPage, { once: true });
    }

    return new Promise(() => {});
  }

  function getStoredValue(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function setStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing or locked-down browsers may reject localStorage.
    }
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256Fallback(value) {
    const bytes = Array.from(new TextEncoder().encode(value));
    const bitLength = bytes.length * 8;
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);

    const highLength = Math.floor(bitLength / 0x100000000);
    const lowLength = bitLength >>> 0;
    bytes.push(
      (highLength >>> 24) & 0xff,
      (highLength >>> 16) & 0xff,
      (highLength >>> 8) & 0xff,
      highLength & 0xff,
      (lowLength >>> 24) & 0xff,
      (lowLength >>> 16) & 0xff,
      (lowLength >>> 8) & 0xff,
      lowLength & 0xff,
    );

    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
      const words = new Array(64);
      for (let index = 0; index < 16; index += 1) {
        const offset = chunk + index * 4;
        words[index] = (
          (bytes[offset] << 24)
          | (bytes[offset + 1] << 16)
          | (bytes[offset + 2] << 8)
          | bytes[offset + 3]
        ) >>> 0;
      }

      for (let index = 16; index < 64; index += 1) {
        const s0 = rightRotate(words[index - 15], 7)
          ^ rightRotate(words[index - 15], 18)
          ^ (words[index - 15] >>> 3);
        const s1 = rightRotate(words[index - 2], 17)
          ^ rightRotate(words[index - 2], 19)
          ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + choice + constants[index] + words[index]) >>> 0;
        const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + majority) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }

    return hash.map((item) => item.toString(16).padStart(8, "0")).join("");
  }

  async function sha256(value) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(value);
      return toHex(await window.crypto.subtle.digest("SHA-256", data));
    }
    return sha256Fallback(value);
  }

  function getExpectedPasswordHash() {
    return String(config.passwordHash || "").trim().toLowerCase();
  }

  async function buildAuthToken(username, passwordHash) {
    return sha256(`${username}:${passwordHash}:lan-transfer`);
  }

  async function validatePassword(password) {
    const expectedHash = getExpectedPasswordHash();
    if (expectedHash) {
      return await sha256(password) === expectedHash;
    }
    if (typeof config.password === "string" && config.password) {
      return password === config.password;
    }
    return false;
  }

  async function authenticate() {
    const username = String(config.username || "").trim();
    const passwordHash = getExpectedPasswordHash();
    const hasPassword = Boolean(passwordHash || config.password);

    if (!username || !hasPassword) {
      return blockPage("局域网快传尚未配置访问账户密码。");
    }

    const storedPasswordHash = passwordHash || await sha256(config.password);
    const expectedToken = await buildAuthToken(username, storedPasswordHash);
    if (getStoredValue(authKey) === expectedToken) {
      clearAuthGate();
      return;
    }

    for (;;) {
      const inputUsername = prompt("请输入账户：");
      if (inputUsername === null) {
        return blockPage("已取消登录。");
      }

      const inputPassword = prompt("请输入密码：");
      if (inputPassword === null) {
        return blockPage("已取消登录。");
      }

      const usernameOk = inputUsername.trim() === username;
      const passwordOk = await validatePassword(inputPassword);

      if (usernameOk && passwordOk) {
        setStoredValue(authKey, expectedToken);
        clearAuthGate();
        return;
      }

      alert("账户或密码不正确，请重试。");
    }
  }

  window.XYX_LAN_TRANSFER_AUTH_READY = authenticate().catch((error) => {
    return blockPage(`登录校验失败：${error.message}`);
  });
}());
