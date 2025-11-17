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
                participation_unique: {
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

        // 3. Check if event exists and user is the company responsible
        const event = await p.events.findFirst({
            where: {
                id: parseInt(eventId),
                situation: 1
            },
            include: {
                company: true
            }
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // Check if user is the company responsible
        if (event.company.responsibleId !== user.user.id) {
            return res.status(403).json({ message: "Você não tem permissão para ver as participações deste evento." });
        }

        // 4. Get participations
        const participations = await p.participation.findMany({
            where: {
                eventId: parseInt(eventId)
            },
            include: {
                user: {
                    include: {
                        client: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // 5. Count by status
        const stats = {
            total: participations.length,
            interestedCount: participations.filter(p => p.status === 1).length,
            checkedInCount: participations.filter(p => p.status === 2).length,
            gaveUpCount: participations.filter(p => p.status === 3).length,
            leftCount: participations.filter(p => p.status === 4).length
        };

        return res.status(200).json({
            participations,
            stats
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
