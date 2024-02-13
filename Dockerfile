# NOTE: Be careful updating this file, as it is used by the setup script.
FROM node:18.19-bookworm

# Set the working directory in the container to /code
WORKDIR /code

# Skip Husky triggers inside container
ENV HUSKY=0

# Cypress is not needed inside container
ENV CYPRESS_INSTALL_BINARY=0

# Create volume mount point at /code
VOLUME ["/code"]

# Install Java for the Emulators
# Install entr for file watching
RUN apt-get update -y && apt-get install -y curl default-jre entr lsof

# Copy package.json and package-lock.json to code
COPY ./package.json .
COPY ./package-lock.json .

# Install project dependencies to /code/node_modules. 
# This is done to prevent node_modules system package conflicts
RUN npm ci

# Copy the development certificate and trust it (Uncomment if the firebase.crt needs to be accessed via Java or the system. NODE_EXTRA_CA_CERTS is used for nodejs certs)
# COPY ./docker/nginx/certs/firebase.crt /usr/local/share/ca-certificates/firebase.crt
# RUN keytool -import -alias FIREBASE_OFFLINE -file /usr/local/share/ca-certificates/firebase.crt -keystore /etc/ssl/certs/java/cacerts
# RUN update-ca-certificates

# Run serve by default
CMD ["npx nx run demo-api:serve"]
