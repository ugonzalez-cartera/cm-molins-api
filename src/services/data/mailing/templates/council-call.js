export function getCouncilCallTemplate (params) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Cartera de Inversiones C.M.</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #ffffff;
      }
      table {
        width: 100%;
        margin: 0 auto;
        background-color: #ffffff;
        border-spacing: 0;
      }
      .container {
        display: block;
        margin: 0 auto;
        max-width: 600px;
        background-color: #ffffff;
      }
      .header img {
        width: 100%;
        max-width: 400px;
        display: block;
        margin-right: auto;
        box-sizing: border-box;
      }
      .image-container img {
        width: 100%;
        max-width: 560px;
        display: block;
        margin-right: auto;
        padding-top: 20px;
      }
      .content {
        padding: 20px 0;
        font-size: 16px;
        color: #333;
      }
      .content h2 {
        font-size: 20px;
        color: #000;
      }
      .button-container {
        text-align: left;
        margin: 20px 0;
      }
      .button {
        display: block;
        margin: 0 auto;
        padding: 10px 20px;
        background-color: #014cb1;
        color: #ffffff !important;
        text-decoration: none;
        font-size: 16px;
        border-radius: 5px;
        width: fit-content;
      }
      .footer {
        text-align: center;
        font-size: 16px;
        color: #666;
        padding: 20px 0;
        background-color: #EFF2F7;
        width: 100%;
        max-width: unset !important;
      }
      .footer strong {
        color: #014cb1;
        font-size: 18px;
      }
  </style>
  </head>
  <body>
    <table>
      <tbody class="container">
        <tr>
          <td class="header">
              <img src="https://res.cloudinary.com/carteracm/image/upload/v1742548063/logo-cartera_ja4zsl.png" alt="logo cartera de inversiones C.M.">
          </td>
        </tr>
        <tr>
          <td class="image-container" align="center">
              <img src="https://res.cloudinary.com/carteracm/image/upload/v1742546271/cartera-mail-img_bttmub.jpg" alt="Company Image">
          </td>
        </tr>
        <tr>
          <td class="content">
            <p>${params.description}</p>
            <p>${params.body}</p>
            <div class="button-container">
                <a href="${params.ctaLink}" class="button">Ir a mi área privada</a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <table class="footer" width="100%">
      <tr>
        <td align="center">
            <strong>Cartera de inversiones C.M.</strong><br>
            <p>Paseo de la Bonanova 64, 08017, Barcelona</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
`
}
