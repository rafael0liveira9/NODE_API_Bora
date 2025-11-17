const p = require('../../lib/prisma');

// GET ALL EVENT TYPES
const GetAllEventTypes = async (req, res) => {
    console.log('GetAllEventTypes 🚀');

    try {
        // Query all active event types
        const eventTypes = await p.eventType.findMany({
            where: {
                situation: 1
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.status(200).json({
            eventTypes
        });

    } catch (error) {
        console.error("❌ Erro ao buscar tipos de eventos:", error);
        return res.status(500).json({ message: "Erro ao buscar tipos de eventos." });
    }
};

module.exports = {
    GetAllEventTypes
};
