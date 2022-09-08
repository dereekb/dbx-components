## SSL Keys for Webhooks Server
The webhooks nginx configuration requires an SSL cert. The default configured one is not suitable for public usage, as it is set up for cdev.dereekb.com.

In most cases you won't need this functionality. This is for manual testing of services such as Stripe.

## SSL Keys for firebase-public.firebaseio.com (offline development)
Typically firebase must be developed while connected to the internet, since it reaches out to https://firebase-public.firebaseio.com/cli.json. If we're offline, it fails and the emulators will fail to update. The issue is tracked here: https://github.com/firebase/firebase-tools/issues/3916

The firebase.crt and firebase.key files were created using:

```
openssl req -x509 -sha256 -newkey rsa:2048 -keyout firebase.key -out firebase.crt -days 9024 -nodes -subj '/CN=firebase-public.firebaseio.com'
```

If you need the local system or Java to access the file, then add this to your Dockerfile:

```
# Copy the development certificate and trust it
COPY ./docker/nginx/certs/firebase.crt /usr/local/share/ca-certificates/firebase.crt
RUN keytool -import -alias FIREBASE_OFFLINE -file /usr/local/share/ca-certificates/firebase.crt -keystore /etc/ssl/certs/java/cacerts
```

Otherwise, if you're just using the firebase cli, you just need to add [NODE_EXTRA_CA_CERTS](https://nodejs.org/api/cli.html#cli_node_extra_ca_certs_file) as an environment variable and have it point to firebase.crt.

This way this works is we add `firebase-public.firebaseio.com` to `extra_hosts` in docker-compose.yml and point it to the local machine. Our docker compose file `docker-compose-nginx-offline.yml` defines an NGINX host that will act as the firebase-public.firebaseio.com host and use the above SSL certificate and serve `cli.json` in the html folder.

Make sure that container is on before the server tries to turn on.
