import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { matchMaker } from "@colyseus/core";
import type { Request, Response } from "express";

/**
 * Import your Room files
 */
import { Dungeon } from "./rooms/Dungeon";

export default config({

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('dungeon', Dungeon);

    },

    initializeExpress: (app) => {
        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        const applyCors = (req: Request, res: Response) => {
            const origin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
            res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
            res.setHeader("Vary", "Origin");
        };

        app.options("/matchmake/:roomName", (req: Request, res: Response) => {
            applyCors(req, res);
            res.sendStatus(204);
        });

        // Compatibility endpoint for lobby polling.
        // Colyseus 0.17 no longer exposes GET /matchmake/:roomName by default.
        app.get("/matchmake/:roomName", async (req: Request, res: Response) => {
            applyCors(req, res);
            const roomName = String(req.params.roomName || "").trim();

            if (!roomName) {
                res.status(400).json({ error: "roomName is required" });
                return;
            }

            try {
                const rooms = await matchMaker.query({
                    name: roomName
                } as any, { createdAt: -1 });

                // Some drivers may omit falsey fields; treat undefined as public/listed.
                const visibleRooms = (rooms as Array<{
                    private?: boolean;
                    unlisted?: boolean;
                }>).filter((room) =>
                    room.private !== true &&
                    room.unlisted !== true
                );
                res.json(visibleRooms);
            } catch (error) {
                console.error("[Lobby] Failed to query rooms:", error);
                res.status(500).json({ error: "Failed to query rooms" });
            }
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground);
        }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/colyseus", monitor());
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
