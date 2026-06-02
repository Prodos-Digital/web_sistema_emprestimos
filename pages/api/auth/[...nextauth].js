import CredentialsProvider from "next-auth/providers/credentials";
import NextAuth from "next-auth";

export const authOptions = {
  // VPS com HTTPS por IP ou domínio atrás de Nginx (ver deploy/hostinger/README.md)
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const username = credentials?.username ?? credentials?.email;
          const password = credentials?.password;
          if (!username || !password) {
            return null;
          }

          const rawBase = process.env.NEXT_INTEGRATION_URL?.trim();
          const baseUrl = rawBase?.replace(/\/$/, "") ?? "";
          if (!baseUrl) {
            console.error(
              "[next-auth] Defina NEXT_INTEGRATION_URL no .env.local (ex.: http://127.0.0.1:8005/integration) e reinicie o next dev."
            );
            return null;
          }

          // Evitar apontar por engano para o próprio Next (devolve HTML → "Unexpected token '<'").
          if (
            /(^|\/)localhost:3000(\/|$)/i.test(baseUrl) ||
            /(^|\/)127\.0\.0\.1:3000(\/|$)/i.test(baseUrl)
          ) {
            console.error(
              "[next-auth] NEXT_INTEGRATION_URL não pode ser a porta 3000 do Next; use a API Django (ex.: http://127.0.0.1:8005/integration)."
            );
            return null;
          }

          const loginUrl = `${baseUrl}/auth/login/`;

          let res;
          try {
            res = await fetch(loginUrl, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/json; charset=UTF-8",
              },
              body: JSON.stringify({
                email: username,
                password,
              }),
            });
          } catch (err) {
            console.error(
              "[next-auth] Não foi possível ligar ao Django em",
              loginUrl,
              err
            );
            return null;
          }

          const text = await res.text();
          const snippet = text.slice(0, 240).replace(/\s+/g, " ");
          if (!text.trim()) {
            console.error("[next-auth] Login: resposta vazia (HTTP", res.status, ")");
            return null;
          }
          if (text.trimStart().startsWith("<")) {
            console.error(
              "[next-auth] O servidor devolveu HTML em vez de JSON. URL usada:",
              loginUrl,
              "| HTTP",
              res.status,
              "| início:",
              snippet
            );
            return null;
          }

          let payload = null;
          try {
            payload = JSON.parse(text);
          } catch (err) {
            console.error(
              "[next-auth] Resposta não é JSON válido (HTTP",
              res.status,
              "):",
              snippet,
              err
            );
            return null;
          }

          // A view Django devolve o UserSerializer + token no mesmo nível (ou aninhado em user).
          const profile = payload?.user ?? payload;
          const accessToken =
            profile?.token ??
            profile?.access ??
            payload?.access ??
            payload?.token;

          if (!res.ok || !profile || !accessToken) {
            if (process.env.NODE_ENV === "development") {
              console.error("[next-auth] Login API:", res.status, payload);
            }
            return null;
          }

          const origem = String(profile.sistema_origem ?? "").trim().toLowerCase();
          // Contas criadas só no Admin podem ter sistema_origem vazio ou inesperado;
          // superuser entra na app (o JWT já confirma autenticação na API).
          const allowedOrigem =
            !origem ||
            origem === "emprestimo" ||
            origem === "dev" ||
            profile.is_superuser === true;

          if (!allowedOrigem) {
            if (process.env.NODE_ENV === "development") {
              console.error(
                "[next-auth] sistema_origem não permitido para esta app:",
                profile.sistema_origem
              );
            }
            return null;
          }

          return {
            ...profile,
            token: accessToken,
            id:
              profile.id != null
                ? String(profile.id)
                : String(profile.email ?? ""),
          };
        } catch (err) {
          console.error("[next-auth] authorize inesperado:", err);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    session({ session, token }) {
      const u = token.user;
      if (u) {
        session.user.username = u.username ?? u.email ?? "";
        session.user.email = u.email ?? "";
        session.user.token = u.token;
        session.user.id = u.id;
      }
      // Descomentar caso seja de interesse nesse projeto retornar as permissões do backend para a session do frontend
      // session.user.perms = token.user.perms;
      // session.user.is_superuser = token.user.is_superuser;

      return session;
    },

    async jwt({ token, account, user }) {
      if (account) {
        token.user = user;
      }

      return token;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },

  jwt: {
    maxAge: 60 * 60 * 8,
  },

  pages: {
    signIn: "/auth/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
