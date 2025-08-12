# Makefile because I forget how to do things

.PHONY: clean

# Runs the app in development mode
run:
	npx expo start

# deploy to github pages https://stephenhouser.com/flopper
deploy:
	npm run deploy
