Simple, scalable and reusable authentication service. It uses HTTPS, if a valid
signed HTTPS certificate is not present browsers will end up warning users.

Some functions need JSON objects to work. The listing is below:

  Function: newUser. Triggers when put request at path '/users/:id' occurs.
  Function: authorizeUser. Triggers when put request at path '/users/:id/auth'
              occurs.

There's further explanation to the code within comments.

Requires key.pem and cert.pem files to work, without those project will not
work.

Has optional arguments, such as auth time(duration of life for a user session)
and ssl-dir(directory in which key.pem and cert.pem reside).

To run:
npm install
node index.js [ -t|--auth-time AUTH_TIME ] [ -d|--ssl-dir SSL_DIR ] PORT
examples:


below example uses default authtime and directory
node index.js 443

below example uses 300 seconds as authtime and default ssl directory
node index.js -t 300 443


Feel free to contact me if you have questions at alicangork@hotmail.com
