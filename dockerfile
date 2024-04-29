# STAGE 1: Build the application
FROM node:20 AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# STAGE 2: Create production image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the build output from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "dist/main"]
