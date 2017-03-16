# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

## FUTURE

[ADDED] - makes from this module a plugin which registers itself ones required to the application (since `bi-service@0.9.0`)

## 0.5.4

[FIXED] - filter out regex pattern in express url segments Eg: /url/:id(\d+) => /url/:id

## 0.5.3

[FIXED] - bugs in validator build logic causing the swagger schema build process to fail completely
[FIXED] - incorrect url tagging algorithm
[REMOVED] - unused `semver` module

## 0.5.2

[FIXED] - swagger schema was being builded too soon as not all valdators were not registered yet

## 0.5.1

[FIXED] - incorrect nonexistent module `json-inspector` required instead of `bi-json-inspector`

## 0.5.0

[ADDED] - first "stable" release
