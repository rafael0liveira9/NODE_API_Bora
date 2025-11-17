const { jwtUncrypt } = require('../../utils/midleware/auth');
const p = require('../../lib/prisma');
const s3 = require('../s3/index');

// Buscar todas as imagens do usuário logado
const GetMyImages = async (req, res) => {
    console.log('GetMyImages 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const images = await p.images.findMany({
            where: {
                clientId: alreadyClient.client.id,
                situation: 1
            },
            orderBy: {
                order: 'asc'
            }
        });

        return res.status(200).json({ images });
    } catch (error) {
        console.error("❌ Erro ao buscar imagens:", error);
        return res.status(500).json({ message: "Erro ao buscar imagens." });
    }
};

// Adicionar nova imagem
const AddImage = async (req, res) => {
    console.log('AddImage 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ message: "URL da imagem é obrigatória." });
        }

        // Buscar a maior ordem atual
        const maxOrderImage = await p.images.findFirst({
            where: {
                clientId: alreadyClient.client.id,
                situation: 1
            },
            orderBy: {
                order: 'desc'
            }
        });

        const newOrder = maxOrderImage ? maxOrderImage.order + 1 : 0;

        const image = await p.images.create({
            data: {
                clientId: alreadyClient.client.id,
                url,
                order: newOrder
            }
        });

        return res.status(201).json({ image });
    } catch (error) {
        console.error("❌ Erro ao adicionar imagem:", error);
        return res.status(500).json({ message: "Erro ao adicionar imagem." });
    }
};

// Deletar imagem (soft delete)
const DeleteImage = async (req, res) => {
    console.log('DeleteImage 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const { imageId } = req.body;

        if (!imageId) {
            return res.status(400).json({ message: "ID da imagem é obrigatório." });
        }

        // Verificar se a imagem pertence ao usuário
        const image = await p.images.findFirst({
            where: {
                id: parseInt(imageId),
                clientId: alreadyClient.client.id,
                situation: 1
            }
        });

        if (!image) {
            return res.status(403).json({ message: "Imagem não encontrada ou você não tem permissão." });
        }

        await p.images.update({
            where: { id: parseInt(imageId) },
            data: {
                situation: 0,
                deletedAt: new Date()
            }
        });

        return res.status(200).json({ message: "Imagem deletada com sucesso." });
    } catch (error) {
        console.error("❌ Erro ao deletar imagem:", error);
        return res.status(500).json({ message: "Erro ao deletar imagem." });
    }
};

// Reordenar imagens
const ReorderImages = async (req, res) => {
    console.log('ReorderImages 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const { images } = req.body; // Array de { id, order }

        if (!images || !Array.isArray(images)) {
            return res.status(400).json({ message: "Array de imagens é obrigatório." });
        }

        // Atualizar a ordem de cada imagem
        const updatePromises = images.map((img) =>
            p.images.updateMany({
                where: {
                    id: parseInt(img.id),
                    clientId: alreadyClient.client.id,
                    situation: 1
                },
                data: {
                    order: parseInt(img.order)
                }
            })
        );

        await Promise.all(updatePromises);

        return res.status(200).json({ message: "Imagens reordenadas com sucesso." });
    } catch (error) {
        console.error("❌ Erro ao reordenar imagens:", error);
        return res.status(500).json({ message: "Erro ao reordenar imagens." });
    }
};

// Buscar imagens de um usuário específico
const GetUserImages = async (req, res) => {
    console.log('GetUserImages 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { clientId } = req.params;

        if (!clientId) {
            return res.status(400).json({ message: "ClientId é obrigatório." });
        }

        const images = await p.images.findMany({
            where: {
                clientId: parseInt(clientId),
                situation: 1
            },
            orderBy: {
                order: 'asc'
            }
        });

        return res.status(200).json({ images });
    } catch (error) {
        console.error("❌ Erro ao buscar imagens:", error);
        return res.status(500).json({ message: "Erro ao buscar imagens." });
    }
};

module.exports = { GetMyImages, GetUserImages, AddImage, DeleteImage, ReorderImages };
