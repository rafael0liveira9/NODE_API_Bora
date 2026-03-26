const p = require('../../lib/prisma');
const { jwtUncrypt } = require('../../utils/midleware/auth');

// CREATE OR UPDATE PARTICIPATION
const UpsertParticipation = async (req, res) => {
    console.log('UpsertParticipation 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Extract required fields
        const { eventId, status } = req.body;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        if (status === undefined || status === null) {
            return res.status(400).json({ message: "Status é obrigatório." });
        }

        if (![0, 1, 2, 3, 4].includes(parseInt(status))) {
            return res.status(400).json({ message: "Status inválido. Deve ser 0, 1, 2, 3 ou 4." });
        }

        // 3. Check if event exists
        const event = await p.events.findFirst({
            where: {
                id: parseInt(eventId),
                situation: 1
            }
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 4. Create or update participation
        const participation = await p.participation.upsert({
            where: {
                userId_eventId: {
                    userId: user.user.id,
                    eventId: parseInt(eventId)
                }
            },
            update: {
                status: parseInt(status),
                updatedAt: new Date()
            },
            create: {
                userId: user.user.id,
                eventId: parseInt(eventId),
                status: parseInt(status)
            }
        });

        return res.status(200).json({
            message: "Participação atualizada com sucesso.",
            participation
        });

    } catch (error) {
        console.error("❌ Erro ao criar/atualizar participação:", error);
        return res.status(500).json({ message: "Erro ao criar/atualizar participação." });
    }
};

// GET USER PARTICIPATION FOR AN EVENT
const GetUserParticipation = async (req, res) => {
    console.log('GetUserParticipation 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Get eventId from params
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 3. Find participation
        const participation = await p.participation.findFirst({
            where: {
                userId: user.user.id,
                eventId: parseInt(eventId)
            }
        });

        return res.status(200).json({
            participation: participation || null
        });

    } catch (error) {
        console.error("❌ Erro ao buscar participação:", error);
        return res.status(500).json({ message: "Erro ao buscar participação." });
    }
};

// GET ALL PARTICIPATIONS FOR AN EVENT (for event organizers)
const GetEventParticipations = async (req, res) => {
    console.log('GetEventParticipations 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Get eventId from params
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 3. Check if event exists
        const event = await p.events.findFirst({
            where: {
                id: parseInt(eventId),
                situation: 1
            }
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 4. Get ALL participations count (only status 1 and 2)
        const totalCount = await p.participation.count({
            where: {
                eventId: parseInt(eventId),
                status: {
                    in: [1, 2]
                }
            }
        });

        // 5. Get participations in random order, limit to 30
        const allParticipations = await p.participation.findMany({
            where: {
                eventId: parseInt(eventId),
                status: {
                    in: [1, 2]  // Only show confirmed and checked-in participants
                }
            },
            include: {
                user: {
                    include: {
                        client: true
                    }
                }
            }
        });

        // Shuffle array randomly and take first 30
        const shuffled = allParticipations.sort(() => Math.random() - 0.5);
        const participations = shuffled.slice(0, 30);

        // 6. Count by status (from all participations, not just the 30 shown)
        const stats = {
            total: totalCount,
            shown: participations.length,
            interestedCount: allParticipations.filter(p => p.status === 1).length,
            checkedInCount: allParticipations.filter(p => p.status === 2).length
        };

        return res.status(200).json({
            participations,
            stats,
            totalCount
        });

    } catch (error) {
        console.error("❌ Erro ao buscar participações:", error);
        return res.status(500).json({ message: "Erro ao buscar participações." });
    }
};

module.exports = {
    UpsertParticipation,
    GetUserParticipation,
    GetEventParticipations
};
