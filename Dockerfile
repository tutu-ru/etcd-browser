FROM centos:7.1.1503
MAINTAINER Andrey Todoshchenko "todoshcenko@tutu.ru"

RUN yum install -y epel-release
RUN yum install -y nodejs

RUN mkdir /app
ADD . /app/

WORKDIR /app
EXPOSE 8000

CMD ["node", "server.js"]
