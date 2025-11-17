const { jwtUncrypt } = require('../../utils/midleware/auth'),
    p = require('../../lib/prisma');

const CreateBlock = async (req, res) => {
    console.log('CreateBlock 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { targetUserId, forbiddenAlertId, period } = req.body;

        if (!targetUserId || !forbiddenAlertId || !period) {
            return res.status(400).json({ message: "userId, forbiddenAlertId e period são obrigatórios." });
        }

        // Verificar se o usuário que está bloqueando é admin
        const adminUser = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!adminUser || adminUser.client.userType !== 1) {
            return res.status(403).json({ message: "Apenas administradores podem bloquear usuários." });
        }

        // Verificar se o forbiddenAlert existe
        const forbiddenAlert = await p.forbiddenAlerts.findFirst({
            where: {
                id: parseInt(forbiddenAlertId)
            }
        });

        if (!forbiddenAlert) {
            return res.status(404).json({ message: "ForbiddenAlert não encontrado." });
        }

        // Criar o block
        const block = await p.blocks.create({
            data: {
                userId: parseInt(targetUserId),
                forbiddenAlertId: parseInt(forbiddenAlertId),
                period: parseInt(period),
                situation: 1
            }
        });

        // Calcular a data de término do bloqueio
        const blockedUntil = new Date();
        blockedUntil.setDate(blockedUntil.getDate() + parseInt(period));

        // Atualizar o bannedUntil do client
        await p.user.findFirst({
            where: { id: parseInt(targetUserId) },
            include: { client: true }
        }).then(async (targetUser) => {
            if (targetUser?.client?.id) {
                await p.client.update({
                    where: { id: targetUser.client.id },
                    data: { bannedUntil: blockedUntil }
                });
            }
        });

        return res.status(200).json({
            message: "Usuário bloqueado com sucesso.",
            block,
            blockedUntil
        });
    } catch (error) {
        console.error("❌ Erro ao criar block:", error);
        return res.status(500).json({ message: "Erro ao criar bloqueio." });
    }
};

const RemoveBlock = async (req, res) => {
    console.log('RemoveBlock 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { blockId } = req.body;

        if (!blockId) {
            return res.status(400).json({ message: "blockId é obrigatório." });
        }

        // Verificar se o usuário que está removendo o bloqueio é admin
        const adminUser = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!adminUser || adminUser.client.userType !== 1) {
            return res.status(403).json({ message: "Apenas administradores podem remover bloqueios." });
        }

        // Verificar se o block existe
        const existingBlock = await p.blocks.findFirst({
            where: {
                id: parseInt(blockId),
                situation: 1
            }
        });

        if (!existingBlock) {
            return res.status(404).json({ message: "Bloqueio não encontrado ou já foi removido." });
        }

        // Atualizar o block para situation 0
        const block = await p.blocks.update({
            where: { id: parseInt(blockId) },
            data: {
                situation: 0,
                updatedAt: new Date()
            }
        });

        // Remover o bannedUntil do client
        await p.user.findFirst({
            where: { id: existingBlock.userId },
            include: { client: true }
        }).then(async (targetUser) => {
            if (targetUser?.client?.id) {
                await p.client.update({
                    where: { id: targetUser.client.id },
                    data: { bannedUntil: null }
                });
            }
        });

        return res.status(200).json({
            message: "Bloqueio removido com sucesso.",
            block
        });
    } catch (error) {
        console.error("❌ Erro ao remover block:", error);
        return res.status(500).json({ message: "Erro ao remover bloqueio." });
    }
};

const GetBlocksByUser = async (req, res) => {
    console.log('GetBlocksByUser 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { targetUserId } = req.params;

        const blocks = await p.blocks.findMany({
            where: {
                userId: parseInt(targetUserId)
            },
            include: {
                forbiddenAlert: true,
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

        return res.status(200).json({ blocks });
    } catch (error) {
        console.error("❌ Erro ao buscar blocks:", error);
        return res.status(500).json({ message: "Erro ao buscar bloqueios." });
    }
};

module.exports = { CreateBlock, RemoveBlock, GetBlocksByUser };
