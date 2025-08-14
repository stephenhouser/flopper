# Makefile because I forget how to do things

.PHONY: clean check

check: lint test

# Runs the app in development mode
run:
	npx expo start

test:
	npm test -- --ci --reporters=default --reporters=github-actions

lint:
	npm run typecheck
	npm run lint

# deploy to github pages https://stephenhouser.com/flopper
deploy:
	npm run deploy

publish: deploy
