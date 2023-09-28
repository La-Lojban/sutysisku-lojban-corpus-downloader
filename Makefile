build:
	docker build -t lojbo_korpora .

dev:
	docker kill lojbo_korpora 2> /dev/null ; \
	docker rm -f lojbo_korpora 2> /dev/null ; \
	docker run -d -it --name lojbo_korpora \
		--env-file ${CURDIR}/.env \
		-v ${CURDIR}/data:/app/data/:Z \
		-v ${CURDIR}/src:/app/src/:Z \
		-w /app \
		lojbo_korpora ; \
	docker exec -it lojbo_korpora bash