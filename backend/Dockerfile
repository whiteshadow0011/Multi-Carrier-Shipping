# 1. Start from an official lightweight Node.js 20 Linux image
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files first to leverage Docker's layer caching
COPY package*.json ./

# 4. Install production dependencies inside the container
RUN npm install

# 5. Copy the rest of your backend source code
COPY . .

# 6. Inform Docker that the application listens on port 5000
EXPOSE 5000

# 7. The command to run when the container starts
CMD ["npm", "run", "dev"]