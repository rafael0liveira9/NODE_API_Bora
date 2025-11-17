const { jwtUncrypt } = require('../../utils/midleware/auth');
const p = require('../../lib/prisma');

// Criar uma nova empresa
const CreateCompany = async (req, res) => {
    console.log('CreateCompany 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { name, cnpj, description, photo, backgroundImage, phone, email } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Nome é obrigatório." });
        }

        if (!cnpj) {
            return res.status(400).json({ message: "CNPJ é obrigatório." });
        }

        // Validar formato do CNPJ
        const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
        if (!cnpjRegex.test(cnpj)) {
            return res.status(400).json({ message: "CNPJ inválido. Use o formato: 00.000.000/0000-00" });
        }

        // Verificar se CNPJ já existe
        const existingCnpj = await p.companies.findFirst({
            where: {
                cnpj: cnpj,
                situation: 1
            }
        });

        if (existingCnpj) {
            return res.status(400).json({ message: "CNPJ já cadastrado." });
        }

        const company = await p.companies.create({
            data: {
                name,
                cnpj,
                description,
                photo,
                backgroundImage,
                phone,
                email,
                responsibleId: user.user.id
            },
            include: {
                responsible: {
                    include: {
                        client: true
                    }
                }
            }
        });

        return res.status(201).json({
            message: "Empresa criada com sucesso!",
            company
        });
    } catch (error) {
        console.error("❌ Erro ao criar empresa:", error);
        return res.status(500).json({ message: "Erro ao criar empresa." });
    }
};

// Editar uma empresa
const UpdateCompany = async (req, res) => {
    console.log('UpdateCompany 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { id, name, cnpj, description, photo, backgroundImage, phone, email } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID da empresa é obrigatório." });
        }

        // Verificar se a empresa pertence ao usuário
        const existingCompany = await p.companies.findFirst({
            where: {
                id: parseInt(id),
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!existingCompany) {
            return res.status(403).json({ message: "Empresa não encontrada ou você não tem permissão." });
        }

        // Se está atualizando o CNPJ, validar
        if (cnpj && cnpj !== existingCompany.cnpj) {
            const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
            if (!cnpjRegex.test(cnpj)) {
                return res.status(400).json({ message: "CNPJ inválido. Use o formato: 00.000.000/0000-00" });
            }

            // Verificar se o novo CNPJ já existe
            const existingCnpj = await p.companies.findFirst({
                where: {
                    cnpj: cnpj,
                    situation: 1,
                    id: { not: parseInt(id) }
                }
            });

            if (existingCnpj) {
                return res.status(400).json({ message: "CNPJ já cadastrado em outra empresa." });
            }
        }

        const company = await p.companies.update({
            where: { id: parseInt(id) },
            data: {
                name: name || existingCompany.name,
                cnpj: cnpj || existingCompany.cnpj,
                description: description !== undefined ? description : existingCompany.description,
                photo: photo !== undefined ? photo : existingCompany.photo,
                backgroundImage: backgroundImage !== undefined ? backgroundImage : existingCompany.backgroundImage,
                phone: phone !== undefined ? phone : existingCompany.phone,
                email: email !== undefined ? email : existingCompany.email,
                updatedAt: new Date()
            },
            include: {
                responsible: {
                    include: {
                        client: true
                    }
                }
            }
        });

        return res.status(200).json({
            message: "Empresa atualizada com sucesso!",
            company
        });
    } catch (error) {
        console.error("❌ Erro ao atualizar empresa:", error);
        return res.status(500).json({ message: "Erro ao atualizar empresa." });
    }
};

// Deletar empresa (soft delete)
const DeleteCompany = async (req, res) => {
    console.log('DeleteCompany 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID da empresa é obrigatório." });
        }

        // Verificar se a empresa pertence ao usuário
        const existingCompany = await p.companies.findFirst({
            where: {
                id: parseInt(id),
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!existingCompany) {
            return res.status(403).json({ message: "Empresa não encontrada ou você não tem permissão." });
        }

        await p.companies.update({
            where: { id: parseInt(id) },
            data: {
                situation: 0,
                deletedAt: new Date()
            }
        });

        return res.status(200).json({ message: "Empresa deletada com sucesso." });
    } catch (error) {
        console.error("❌ Erro ao deletar empresa:", error);
        return res.status(500).json({ message: "Erro ao deletar empresa." });
    }
};

// Buscar todas as empresas (paginado com filtro)
const GetAllCompanies = async (req, res, page, pageSize, search) => {
    console.log('GetAllCompanies 🚀');

    try {
        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        // Construir filtros
        let whereClause = {
            situation: 1
        };

        // Se houver search, buscar em nome e descrição
        if (search && search.length > 0) {
            whereClause.OR = [
                { name: { contains: search } },
                { description: { contains: search } }
            ];
        }

        // Contar total de empresas
        const total = await p.companies.count({
            where: whereClause
        });

        // Buscar empresas paginadas
        const companies = await p.companies.findMany({
            where: whereClause,
            include: {
                responsible: {
                    include: {
                        client: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit
        });

        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            companies
        });
    } catch (error) {
        console.error("❌ Erro ao buscar empresas:", error);
        return res.status(500).json({ message: "Erro ao buscar empresas." });
    }
};

// Buscar uma empresa por ID
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
                situation: 1
            },
            include: {
                responsible: {
                    include: {
                        client: true
                    }
                }
            }
        });

        if (!company) {
            return res.status(404).json({ message: "Empresa não encontrada." });
        }

        return res.status(200).json({ company });
    } catch (error) {
        console.error("❌ Erro ao buscar empresa:", error);
        return res.status(500).json({ message: "Erro ao buscar empresa." });
    }
};

// Criar post como empresa
const CreateCompanyPost = async (req, res) => {
    console.log('CreateCompanyPost 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // Buscar empresa do usuário
        const userCompany = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!userCompany) {
            return res.status(403).json({ message: "Você não é responsável de nenhuma empresa." });
        }

        const { title, description, image, type } = req.body;

        if (!title && !description && !image) {
            return res.status(400).json({ message: "É necessário enviar título, descrição ou imagem." });
        }

        const post = await p.posts.create({
            data: {
                title: title || null,
                description: description || null,
                image: image?.url || image || null,
                companyId: userCompany.id,
                type: type || 1
            },
            include: {
                company: true
            }
        });

        return res.status(201).json({
            message: "Post da empresa criado com sucesso!",
            post
        });
    } catch (error) {
        console.error("❌ Erro ao criar post da empresa:", error);
        return res.status(500).json({ message: "Erro ao criar post da empresa." });
    }
};

// Editar post da empresa
const UpdateCompanyPost = async (req, res) => {
    console.log('UpdateCompanyPost 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { id, title, description, image, type } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID do post é obrigatório." });
        }

        // Buscar empresa do usuário
        const userCompany = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!userCompany) {
            return res.status(403).json({ message: "Você não é responsável de nenhuma empresa." });
        }

        // Verificar se o post pertence à empresa
        const existingPost = await p.posts.findFirst({
            where: {
                id: parseInt(id),
                companyId: userCompany.id,
                situation: 1
            }
        });

        if (!existingPost) {
            return res.status(403).json({ message: "Post não encontrado ou você não tem permissão." });
        }

        const post = await p.posts.update({
            where: { id: parseInt(id) },
            data: {
                title: title !== undefined ? title : existingPost.title,
                description: description !== undefined ? description : existingPost.description,
                image: image !== undefined ? (image?.url || image) : existingPost.image,
                type: type !== undefined ? type : existingPost.type,
                updatedAt: new Date()
            },
            include: {
                company: true
            }
        });

        return res.status(200).json({
            message: "Post da empresa atualizado com sucesso!",
            post
        });
    } catch (error) {
        console.error("❌ Erro ao atualizar post da empresa:", error);
        return res.status(500).json({ message: "Erro ao atualizar post da empresa." });
    }
};

// Deletar post da empresa
const DeleteCompanyPost = async (req, res) => {
    console.log('DeleteCompanyPost 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID do post é obrigatório." });
        }

        // Buscar empresa do usuário
        const userCompany = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!userCompany) {
            return res.status(403).json({ message: "Você não é responsável de nenhuma empresa." });
        }

        // Verificar se o post pertence à empresa
        const existingPost = await p.posts.findFirst({
            where: {
                id: parseInt(id),
                companyId: userCompany.id,
                situation: 1
            }
        });

        if (!existingPost) {
            return res.status(403).json({ message: "Post não encontrado ou você não tem permissão." });
        }

        await p.posts.update({
            where: { id: parseInt(id) },
            data: {
                situation: 0,
                updatedAt: new Date()
            }
        });

        return res.status(200).json({ message: "Post da empresa deletado com sucesso." });
    } catch (error) {
        console.error("❌ Erro ao deletar post da empresa:", error);
        return res.status(500).json({ message: "Erro ao deletar post da empresa." });
    }
};

// Buscar posts da empresa
const GetCompanyPosts = async (req, res) => {
    console.log('GetCompanyPosts 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // Buscar empresa do usuário
        const userCompany = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!userCompany) {
            return res.status(403).json({ message: "Você não é responsável de nenhuma empresa." });
        }

        const posts = await p.posts.findMany({
            where: {
                companyId: userCompany.id,
                situation: 1
            },
            include: {
                company: true,
                _count: {
                    select: {
                        comments: {
                            where: {
                                situation: 1
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({ posts });
    } catch (error) {
        console.error("❌ Erro ao buscar posts da empresa:", error);
        return res.status(500).json({ message: "Erro ao buscar posts da empresa." });
    }
};

module.exports = {
    CreateCompany,
    UpdateCompany,
    DeleteCompany,
    GetAllCompanies,
    GetCompanyById,
    CreateCompanyPost,
    UpdateCompanyPost,
    DeleteCompanyPost,
    GetCompanyPosts
};
