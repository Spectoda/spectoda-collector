# Gateway Specifikace

### Předpoklady
- Zařízení má nakonfigurovaný Spectoda-Node a Docker + docker-compose

## **Co gateway posílá**

1\. všechny stavy eventů

2\. connection time, disconnect time, restart time, sync failed time, internet not available time

Kromě restart time, internet a sync failed si všechny věci ukládá pouze při změně (tzv stačí nám vědět čas kdy se zařízení odpojilo a kdy odpojilo než každou minutu jaký byl stav).

  

Technické detaily:

**Gateway:**

*   Spectoda Node (o něm dokument teprve vznikne)
*   Spectoda Collector

**Cloud:**

*   TimeScaleDB (je to postgres má cool věci navíc...)
*   SpectodaCloud (sběrač dat, hlídá práva, poskytuje websocket connector apod.)

  

### Spectoda Collector (client)

*   Spectoda Collector sbírá data lokálně do Orange Pi

V dokumentaci máme napsáno že se data ukládájí do **Prometheus db** a však to v praxi nebude úplně pravda

  

Účel Prometheus db zůstane primárně na debugging a na experimentální věci o kterých si ještě nebudem jisti zda je chcem sbírát

  

Data co mají účel jít do cloudu se budou ukládat do Sqlite db. Jednoduchá databáze co má jedinný účel. Uchovat data po dobu než se pošlou na cloud (berme to jako takový buffer co přežije restarty apod.)

  

## Spectoda Cloud (server)

*   Věc co běží 24/7 a je vždy připravena propojit 2 zařízení přes net skrze WebSockety a zároveň schopna sbírát data od Collectoru co mu pošlou

#### Proces autorizace gatewaye

gateway po spuštění:

1\. zjistí svůj stav

2\. zkusí se připojit na net.

3\. pokud net nejde, tak čeká

4\. po připojení na net pošle speciální požadavek na server a ten zpátky vrátí podepsaný JWT token.

5\. Gateway si token uloží a při posílaní dat skrze https posíla v hlavičce Authorization header s tímto tokenem.

6\. Backend si zjistí z databáze k jakýmu networku daný request patři a uloží ho i s identifikátorem gatewaye a networku do DB