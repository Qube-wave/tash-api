export const emailOtpTemplate = ({
  otp,
  expiresIn,
  maxAttempts,
  year,
}: {
  otp: string;
  expiresIn: string;
  maxAttempts: string;
  year: string;
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tash Sign-in Code</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #fff6ee;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f1714;
    "
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="padding: 40px 16px"
    >
      <tr>
        <td align="center">
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            role="presentation"
            style="
              max-width: 420px;
              background-color: #ffffff;
              border-radius: 22px;
              padding: 40px 32px;
            "
          >
            <tr>
              <td align="center">
                <!-- Logo -->
                <div
                  style="
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background-color: #c75a3a;
                    color: #fff6ee;
                    font-size: 24px;
                    font-weight: 700;
                    line-height: 44px;
                    text-align: center;
                    margin-bottom: 20px;
                  "
                >
                  P
                </div>

                <!-- Title -->
                <p
                  style="
                    margin: 0 0 28px;
                    font-size: 14px;
                    color: #1f1714;
                  "
                >
                  Sign-in Code
                </p>

                <!-- OTP -->
                <div
                  style="
                    margin-bottom: 24px;
                    font-size: 34px;
                    letter-spacing: 8px;
                    color: #1f1714;
                    font-weight: 400;
                  "
                >
                  ${otp}
                </div>

                <!-- Description -->
                <p
                  style="
                    margin: 0 0 14px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #8a7d76;
                  "
                >
                  Here is the sign-in code you requested.
                </p>

                <p
                  style="
                    margin: 0 0 20px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #8a7d76;
                  "
                >
                  This code expires in ${expiresIn}.
                </p>

                <p
                  style="
                    margin: 0 0 30px;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #a94e2c;
                  "
                >
                  You have ${maxAttempts} verification attempts.
                </p>

                <!-- Security Notice -->
                <p
                  style="
                    margin: 0 0 34px;
                    font-size: 13px;
                    line-height: 1.7;
                    color: #9c918b;
                  "
                >
                  No one representing Tash will ever ask for this code over the
                  phone, on social media, or through any other medium.
                </p>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <p
            style="
              margin: 22px 0 0;
              font-size: 12px;
              color: #b2aaa5;
              text-align: center;
            "
          >
            © ${year} Tash.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};
