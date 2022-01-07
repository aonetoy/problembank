FROM ubuntu:latest

CMD echo "Hello ubuntu"

# File permissions
RUN chmod 1777 /tmp

# Update the repository
RUN apt-get update

# Install necessary tools
RUN apt-get install -y nano wget dialog net-tools vim git curl gnupg

# Install nodejs
RUN curl -sL https://deb.nodesource.com/setup_12.x  | bash -
RUN apt-get -y install nodejs

# Install python
RUN apt-get -y install python3 python3-pip

# Install clang complie with c/c++
RUN apt-get -y install clang-7

# Install c/c++
RUN apt-get -y install gcc g++

# Install OpenJDK
# RUN apt-get -y install default-jdk

RUN mkdir -p /home/plass/problem-score-server

WORKDIR /home/plass/problem-score-server

COPY package*.json ./

COPY . .


RUN npm install

EXPOSE 3005

CMD npm start


#CMD [ "nginx", "-g", "daemon off;" ]