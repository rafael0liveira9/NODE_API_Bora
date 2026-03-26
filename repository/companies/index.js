const p = require('../../lib/prisma');
const { jwtUncrypt } = require('../../utils/midleware/auth');

// GET MY COMPANY (empresa que o usuário é responsável)
const GetMyCompany = async (req, res) => {
    console.log('GetMyCompany 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Buscar empresa onde o usuário é responsável
        const company = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1,
                deletedAt: null
            }
        });

        if (!company) {
            return res.status(404).json({
                message: "Você não é responsável por nenhuma empresa.",
                company: null
            });
        }

        return res.status(200).json({
            company
        });

    } catch (error) {
        console.error("❌ Erro ao buscar empresa:", error);
        return res.status(500).json({ message: "Erro ao buscar empresa." });
    }
};

// GET COMPANY BY ID
const GetCompanyById = async (req, res) => {
    console.log('GetCompanyById 🚀');

    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "ID da empresa é obrigatório." });
        }

        const company = await p.companies.findFirst({
            where: {
                id: parseInt(id),
                situation: 1,
                deletedAt: null
            }
        });

        if (!company) {
            return res.status(404).json({
                message: "Empresa não encontrada.",
                company: null
            });
        }

        return res.status(200).json({
            company
        });

    } catch (error) {
        console.error("❌ Erro ao buscar empresa:", error);
        return res.status(500).json({ message: "Erro ao buscar empresa." });
    }
};

// CREATE COMPANY
const CreateCompany = async (req, res) => {
    console.log('CreateCompany 🚀');
    return res.status(501).json({ message: "Função não implementada ainda." });
};

// UPDATE COMPANY
const UpdateCompany = async (req, res) => {
    console.log('UpdateCompany 🚀');
    return res.status(501).json({ message: "Função não implementada ainda." });
};

// DELETE COMPANY
const DeleteCompany = async (req, res) => {
    console.log('DeleteCompany 🚀');
    return res.status(501).json({ message: "Função não implementada ainda." });
};

// GET COMPANY POSTS
const GetCompanyPosts = async (req, res) => {
    console.log('GetCompanyPosts 🚀');
    return res.status(501).json({ message: "Função não implementada ainda." });
};

// CREATE COMPANY POST
const CreateCompanyPost = async (req, res) => {
    console.log('CreateCompanyPost 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Verificar se o usuário tem uma empresa
        const company = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1,
                deletedAt: null
            }
        });

        if (!company) {
            return res.status(403).json({
                message: "Você não possui uma empresa para criar posts."
            });
        }

        // 3. Criar post da empresa
        const { title, description, image, video } = req.body;

        const post = await p.posts.create({
            data: {
                title,
                description,
                image,
                video,
                companyId: company.id,
                type: 2, // Tipo 2 = post de empresa
                situation: 1
            }
        });

        return res.status(201).json({
            message: "Post criado com sucesso!",
            post
        });

    } catch (error) {
        console.error("❌ Erro ao criar post da empresa:", error);
        return res.status(500).json({ message: "Erro ao criar post." });
    }
};

// UPDATE COMPANY POST
const UpdateCompanyPost = async (req, res) => {
    console.log('UpdateCompanyPost 🚀');
    return res.status(501).json({ message: "Função não implementada ainda." });
};

// DELETE COMPANY POST
const DeleteCompanyPost = async (req, res) => {
    console.log('DeleteCompanyPost 🚀');
    return res.status(501).json({ message: "Função não implementada ainda." });
};

module.exports = {
    GetMyCompany,
    GetCompanyById,
    CreateCompany,
    UpdateCompany,
    DeleteCompany,
    GetCompanyPosts,
    CreateCompanyPost,
    UpdateCompanyPost,
    DeleteCompanyPost
};
