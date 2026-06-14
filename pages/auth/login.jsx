import React, { useState, useEffect } from "react";
import Image from "next/image";

import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

//Mui components
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

//Icons
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LoginIcon from "@mui/icons-material/Login";

export default function SingIn() {
  const router = useRouter();
  const { status } = useSession();

  const ownerEmail =
    process.env.NEXT_PUBLIC_OWNER_EMAIL || "cedulapromotora@gmail.com";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lembrarEmail, setLembrarEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setLoginError(false);

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push("/");
      } else {
        console.log("error: ", result.error);
        setLoginError(true);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error signing in:", error);
      setLoading(false);
      setLoginError(true);
    }
  };

  useEffect(() => {
    getEmailLocalStorage();
  }, []);

  const getEmailLocalStorage = () => {
    const email = localStorage.getItem("@app-sistemaemprestimo");

    if (email) {
      setLembrarEmail(true);
      setEmail(JSON.parse(email));
    }
  };

  function handleSaveEmailLocalStorage() {
    if (lembrarEmail) {
      localStorage.removeItem("@app-sistemaemprestimo");
      setLembrarEmail(false);
    } else {
      setLembrarEmail(true);
    }
  }

  function salvarEmailLocalStorage() {
    localStorage.setItem("@app-sistemaemprestimo", JSON.stringify(email));
  }

  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  if (status == "authenticated") {
    router.push("/");
  } else if (status == "unauthenticated") {
    return (
      <>
        <Box
          sx={{
            width: "100%",
            height: "100vh",
            flexGrow: 1,
            //background: "#292929",
            background:
              "url(/img/background_login_page.jpg) center center/cover no-repeat",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              flexDirection: "column",
              width: "100%",
              maxWidth: 400,
              backgroundColor: "#fff",
              paddingBottom: 3,
              boxShadow: "rgba(0, 0, 0,0.5) 0px 20px 30px -10px",

              ["@media (max-width:600px)"]: {
                maxWidth: "100%",
                //height: "100%",
                width: "95%",
                borderRadius: 0,
                justifyContent: "center",
                //backgroundColor: "transparent",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 190,
                position: "relative",
                overflow: "hidden",
                mb: 2,
                background: "#292929",
                background: "linear-gradient(180deg, #292929, #292929)",
              }}
            >
              <Typography
                sx={{
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: 30,
                  textAlign: "center",
                }}
              >
                Sistema de controle
                <br />
                de empréstimos
              </Typography>
            </Box>

            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "90%",
                flexDirection: "column",
              }}
            >
              <TextField
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="text"
                variant="outlined"
                size="small"
                fullWidth
                label="Insira o e-mail"
                placeholder="Insira o seu endereço de e-mail"
                InputLabelProps={{ shrink: true }}
                autoComplete="off"
                sx={{ mt: 1 }}
              />

              <TextField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                //error={Boolean(error)}
                label="Senha"
                placeholder="Insira sua senha"
                sx={{
                  marginTop: "20px",
                  fontSize: 12,
                }}
                fullWidth
                size="small"
                type={showPassword ? "text" : "password"}
                InputLabelProps={{ shrink: true }}
                inputProps={{ maxLength: 128 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment
                      position="end"
                      sx={{ cursor: "pointer" }}
                      onClick={handleShowPassword}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon
                          sx={{
                            color: "#B7B7B7",
                            fontSize: 18,
                            "&:hover": { color: "#7a7a7a" },
                          }}
                        />
                      ) : (
                        <VisibilityIcon
                          sx={{
                            color: "#B7B7B7",
                            fontSize: 18,
                            "&:hover": { color: "#7a7a7a" },
                          }}
                        />
                      )}
                    </InputAdornment>
                  ),
                }}
              />

              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <FormGroup
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        sx={{
                          color: "#292929",
                          "&.Mui-checked": {
                            color: "#292929",
                          },
                        }}
                        checked={lembrarEmail}
                        onChange={handleSaveEmailLocalStorage}
                      />
                    }
                    label={
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: 12,
                          color: "#292929",
                        }}
                      >
                        Lembrar e-mail?
                      </Typography>
                    }
                  />
                </FormGroup>
              </Box>

              <Button
                type="submit"
                variant="contained"
                disableElevation
                sx={{ marginTop: "10px", minHeight: 36.5 }}
                fullWidth
                disabled={loading ? true : false}
                onClick={() => {
                  if (lembrarEmail) {
                    salvarEmailLocalStorage();
                  }
                }}
                endIcon={!loading && <LoginIcon />}
              >
                {loading ? (
                  <CircularProgress sx={{ color: "#fff" }} size={22} />
                ) : (
                  "Acessar"
                )}
              </Button>

              {loginError && (
                <Stack sx={{ width: "100%", mt: 2 }}>
                  <Alert severity="error">Senha ou e-mail incorretos.</Alert>
                </Stack>
              )}
            </Box>
          </Box>

          <Typography
            sx={{
              color: "#292929",
              position: "absolute",
              bottom: 20,
              left: 20,
              fontSize: { xs: 12, sm: 14, md: 14, lg: 16, xl: 16 },

              a: {
                "&:hover": {
                  textDecoration: "underline",
                },
              },
            }}
          >
            Contato / proprietário:{" "}
            <strong>
              <a href={`mailto:${ownerEmail}`}>{ownerEmail}</a>
            </strong>
            <br />
            Desenvolvido por:{" "}
            <strong>
              <a href="https://linktr.ee/gtech.servicos" target="_blank">
                GTECH
              </a>
            </strong>
          </Typography>
        </Box>
      </>
    );
  }
}
