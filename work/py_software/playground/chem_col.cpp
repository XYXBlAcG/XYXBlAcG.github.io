#include <iostream>
#include <cstdio>
using namespace std;
int s, tot, rev[800005], n, T;
const int mod = 998244353;
long long A[800005], inv[800005], A2[800005], A3[800005], ans[800005], C[800005];
inline long long read() {
    long long f = 1, w = 0;
    char ch = 0;

    while (ch < '0' || ch > '9') {
        if (ch == '-')
            f = -1;

        ch = getchar();
    }

    while (ch >= '0' && ch <= '9')
        w = (w << 1) + (w << 3) + ch - '0', ch = getchar();

    return f * w;
}
long long ksm(long long a, long long p) {
    long long ret = 1ll;

    while (p) {
        if (p & 1)
            (ret *= a) %= mod;

        (a *= a) %= mod, p >>= 1;
    }

    return ret;
}
void ntt(long long *a, int N, int in) {
    for (int i = 0; i < N; i++)
        if (i < rev[i])
            swap(a[i], a[rev[i]]);

    for (int i = 1; i < N; i <<= 1) {
        long long wn = ksm(3, (mod - 1) / i / 2);

        if (in == -1)
            wn = ksm(wn, mod - 2);

        for (int j = 0; j < N; j += i << 1) {
            long long w = 1;

            for (int k = j; k < i + j; k++) {
                long long x = a[k], y = w * a[k + i] % mod;
                a[k] = (x + y) % mod, a[k + i] = (mod + x - y) % mod, (w *= wn) %= mod;
            }
        }
    }

    if (in == -1)
        for (int i = 0; i < N; i++)
            (a[i] *= inv[N]) %= mod;
}
void solve(int l, int r) {
    if (l == r) {
        (A[l] += (l % 3 == 1) * A[l / 3] * inv[3] % mod) %= mod;
        return;
    }

    int mid = (l + r) >> 1;
    solve(l, mid), s = 2, tot = 1;
    static long long a1[800005], a2[800005], b[800005], c[800005];

    while (s <= (2 * (r - l + 1)))
        s <<= 1, ++tot;

    for (int i = 0; i < s; i++)
        a1[i] = i <= mid - l ? A[l + i] : 0, a2[i] = i <= r - l ? A[i] : 0, b[i] = (i <= r - l &&
                !(i & 1)) ? A[i / 2] : 0;

    for (int i = 0; i < s; i++)
        rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (tot - 1));

    ntt(a1, s, 1), ntt(a2, s, 1), ntt(b, s, 1);

    for (int i = 0; i < s; i++)
        c[i] = (a1[i] * a2[i] % mod * a2[i] % mod * (l ? inv[2] : inv[6]) % mod + a1[i] * b[i] % mod * inv[2] % mod) %
               mod;

    ntt(c, s, -1);

    for (int i = mid - l; i <= r - l - 1; i++)
        (A[l + i + 1] += c[i]) %= mod;

    solve(mid + 1, r);
}
int main() {
    inv[0] = inv[1] = 1, T = read();

    for (int i = 2; i <= 800000; i++)
        inv[i] = (mod - mod / i) * inv[mod % i] % mod;

    A[0] = 1, solve(0, 100000), s = 2, tot = 1;

    while (s <= 300000)
        s <<= 1, ++tot;

    for (int i = 0; i <= 100000; i++)
        A2[i] = i & 1 ? 0 : A[i / 2], A3[i] = i % 3 ? 0 : A[i / 3];

    for (int i = 0; i <= 100000; i++)
        if (i % 4 == 1)
            ans[i] = A[i / 4] * inv[4] % mod;

    for (int i = 0; i <= 100000; i++)
        if (!(i & 1))
            ans[i] = A[i / 2];

    for (int i = 0; i < s; i++)
        rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (tot - 1));

    ntt(A, s, 1), ntt(A2, s, 1), ntt(A3, s, 1);

    for (int i = 0; i < s; i++)
        C[i] = (A2[i] * A2[i] % mod * inv[8] % mod + A[i] * A[i] % mod * A2[i] % mod * inv[4] % mod + A[i] * A3[i] %
                mod * inv[3] % mod + A[i] * A[i] % mod * A[i] % mod * A[i] % mod * inv[24] % mod) % mod;

    ntt(C, s, -1);

    for (int i = 0; i <= 100000; i++)
        (ans[i + 1] += C[i]) %= mod;

    for (int i = 0; i < s; i++)
        C[i] = (A[i] * A[i] % mod * inv[2] % mod + A2[i] * inv[2] % mod - A[i] + mod) % mod;

    ntt(C, s, -1);

    for (int i = 0; i <= 100000; i++)
        (ans[i] += mod - C[i]) %= mod;

    for (; T; T--)
        n = read(), printf("%lld\n", ans[n]);

    return 0;
}