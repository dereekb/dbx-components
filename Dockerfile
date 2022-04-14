FROM node:16.14-bullseye

# Set the working directory in the container to /code
WORKDIR /code

# Skip Husky triggers inside container
ENV HUSKY=0

# Create volume mount point at /code
VOLUME ["/code"]

# Install Java for the Emulators
# Install entr for file watching, as the 
RUN apt-get update -y && apt-get install -y curl openjdk-11-jre-headless entr

# Copy package.json and package-lock.json to code
COPY ./package.json .
COPY ./package-lock.json .

# Install project dependencies to /code/node_modules. 
# This is done to prevent node_modules system package conflicts
RUN npm ci

# Run serve by default
CMD ["npx nx serve demo-api"]
