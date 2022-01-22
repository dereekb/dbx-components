FROM node:16.13-bullseye

# Set the working directory in the container to /code
WORKDIR /code

# Install Nx, Nest CLI and Firebase Tools
RUN npm i -g nx@13.4.3 @nestjs/cli@8.2.0 firebase-tools@10.1.2

# Copy package.json and package-lock.json to code
COPY ./package.json .
COPY ./package-lock.json .

# Skip Husky Usage inside container
ENV HUSKY=0

# Install project dependencies to /code/node_modules. 
# This is done to prevent node_modules system package conflicts
RUN npm install


# Create volume mount point at /code
VOLUME ["/code"]

# Install Java for the Emulators
RUN apt-get update && apt-get -y install default-jre

# Run Project by default
CMD sh d-run.sh
