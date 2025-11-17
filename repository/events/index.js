const p = require('../../lib/prisma');
const { jwtUncrypt } = require('../../utils/midleware/auth');

// CREATE EVENT
const CreateEvent = async (req, res) => {
    console.log('CreateEvent 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Check if user is responsible for a company
        const userCompany = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!userCompany) {
            return res.status(403).json({
                message: "Você não é responsável de nenhuma empresa. Apenas responsáveis de empresas podem criar eventos."
            });
        }

        // 3. Extract and validate required fields
        const {
            name,
            description,
            photo,
            backgroundImage,
            isPublic,
            isPublicMetrics,
            promotionalText,
            promotionalVideo,
            promotionalImage,
            promotionalUrl,
            eventTypeId,
            startAt,
            endAt
        } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Nome do evento é obrigatório." });
        }

        if (!description) {
            return res.status(400).json({ message: "Descrição do evento é obrigatória." });
        }

        if (!eventTypeId) {
            return res.status(400).json({ message: "Tipo do evento é obrigatório." });
        }

        if (!startAt) {
            return res.status(400).json({ message: "Data e hora de início são obrigatórias." });
        }

        if (!endAt) {
            return res.status(400).json({ message: "Data e hora de término são obrigatórias." });
        }

        // 4. Validate eventType exists
        const eventType = await p.eventType.findFirst({
            where: {
                id: parseInt(eventTypeId),
                situation: 1
            }
        });

        if (!eventType) {
            return res.status(404).json({ message: "Tipo de evento não encontrado." });
        }

        // 5. Validate dates
        const startDate = new Date(startAt);
        const endDate = new Date(endAt);

        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ message: "Data de início inválida." });
        }

        if (isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Data de término inválida." });
        }

        if (endDate <= startDate) {
            return res.status(400).json({ message: "Data de término deve ser posterior à data de início." });
        }

        // 6. Create event
        const event = await p.events.create({
            data: {
                name,
                description,
                photo: photo || null,
                backgroundImage: backgroundImage || null,
                isPublic: isPublic !== undefined ? Boolean(isPublic) : false,
                isPublicMetrics: isPublicMetrics !== undefined ? Boolean(isPublicMetrics) : true,
                promotionalText: promotionalText || null,
                promotionalVideo: promotionalVideo || null,
                promotionalImage: promotionalImage || null,
                promotionalUrl: promotionalUrl || null,
                companyId: userCompany.id,
                eventTypeId: parseInt(eventTypeId),
                startAt: startDate,
                endAt: endDate
            },
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true
            }
        });

        // 7. Add initial capacity of 100 people
        await p.eventCapacity.create({
            data: {
                eventId: event.id,
                type: "deposit",
                quantity: 100,
                description: "Capacidade inicial do evento",
                userId: user.user.id
            }
        });

        // 8. Get event with capacity
        const eventWithCapacity = await p.events.findUnique({
            where: { id: event.id },
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true,
                eventCapacity: true
            }
        });

        return res.status(201).json({
            message: "Evento criado com sucesso com capacidade inicial de 100 pessoas!",
            event: eventWithCapacity
        });

    } catch (error) {
        console.error("❌ Erro ao criar evento:", error);
        return res.status(500).json({ message: "Erro ao criar evento." });
    }
};

// UPDATE EVENT
const UpdateEvent = async (req, res) => {
    console.log('UpdateEvent 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Extract ID and validate
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 3. Check if event exists and user has permission
        const existingEvent = await p.events.findFirst({
            where: {
                id: parseInt(id),
                situation: 1
            },
            include: {
                company: true
            }
        });

        if (!existingEvent) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 4. Check if user is the company responsible
        if (existingEvent.company.responsibleId !== user.user.id) {
            return res.status(403).json({
                message: "Você não tem permissão para editar este evento."
            });
        }

        // 5. Extract update fields
        const {
            name,
            description,
            photo,
            backgroundImage,
            isPublic,
            isPublicMetrics,
            promotionalText,
            promotionalVideo,
            promotionalImage,
            promotionalUrl,
            eventTypeId,
            startAt,
            endAt
        } = req.body;

        // 6. Build update data object
        const updateData = {
            updatedAt: new Date()
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (photo !== undefined) updateData.photo = photo;
        if (backgroundImage !== undefined) updateData.backgroundImage = backgroundImage;
        if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);
        if (isPublicMetrics !== undefined) updateData.isPublicMetrics = Boolean(isPublicMetrics);
        if (promotionalText !== undefined) updateData.promotionalText = promotionalText;
        if (promotionalVideo !== undefined) updateData.promotionalVideo = promotionalVideo;
        if (promotionalImage !== undefined) updateData.promotionalImage = promotionalImage;
        if (promotionalUrl !== undefined) updateData.promotionalUrl = promotionalUrl;

        // 7. Validate and update eventTypeId if provided
        if (eventTypeId !== undefined) {
            const eventType = await p.eventType.findFirst({
                where: {
                    id: parseInt(eventTypeId),
                    situation: 1
                }
            });

            if (!eventType) {
                return res.status(404).json({ message: "Tipo de evento não encontrado." });
            }

            updateData.eventTypeId = parseInt(eventTypeId);
        }

        // 8. Validate and update dates if provided
        if (startAt !== undefined || endAt !== undefined) {
            const newStartAt = startAt ? new Date(startAt) : existingEvent.startAt;
            const newEndAt = endAt ? new Date(endAt) : existingEvent.endAt;

            if (startAt && isNaN(newStartAt.getTime())) {
                return res.status(400).json({ message: "Data de início inválida." });
            }

            if (endAt && isNaN(newEndAt.getTime())) {
                return res.status(400).json({ message: "Data de término inválida." });
            }

            if (newEndAt <= newStartAt) {
                return res.status(400).json({ message: "Data de término deve ser posterior à data de início." });
            }

            if (startAt) updateData.startAt = newStartAt;
            if (endAt) updateData.endAt = newEndAt;
        }

        // 9. Update event
        const event = await p.events.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true
            }
        });

        return res.status(200).json({
            message: "Evento atualizado com sucesso!",
            event
        });

    } catch (error) {
        console.error("❌ Erro ao atualizar evento:", error);
        return res.status(500).json({ message: "Erro ao atualizar evento." });
    }
};

// DELETE EVENT (SOFT DELETE)
const DeleteEvent = async (req, res) => {
    console.log('DeleteEvent 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Extract ID
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 3. Check if event exists and user has permission
        const existingEvent = await p.events.findFirst({
            where: {
                id: parseInt(id),
                situation: 1
            },
            include: {
                company: true
            }
        });

        if (!existingEvent) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 4. Check if user is the company responsible
        if (existingEvent.company.responsibleId !== user.user.id) {
            return res.status(403).json({
                message: "Você não tem permissão para deletar este evento."
            });
        }

        // 5. Soft delete
        await p.events.update({
            where: { id: parseInt(id) },
            data: {
                situation: 0,
                deletedAt: new Date()
            }
        });

        return res.status(200).json({ message: "Evento deletado com sucesso." });

    } catch (error) {
        console.error("❌ Erro ao deletar evento:", error);
        return res.status(500).json({ message: "Erro ao deletar evento." });
    }
};

// GET ALL EVENTS (WITH PAGINATION AND SEARCH)
const GetAllEvents = async (req, res, page, pageSize, search) => {
    console.log('GetAllEvents 🚀');

    try {
        // 1. Parse pagination params
        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        // 2. Build where clause with search
        let whereClause = { situation: 1 };

        if (search && search.length > 0) {
            whereClause.OR = [
                { name: { contains: search } },
                { description: { contains: search } }
            ];
        }

        // 3. Count total
        const total = await p.events.count({ where: whereClause });

        // 4. Query with pagination
        const events = await p.events.findMany({
            where: whereClause,
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit
        });

        // 5. Return response
        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            events
        });

    } catch (error) {
        console.error("❌ Erro ao buscar eventos:", error);
        return res.status(500).json({ message: "Erro ao buscar eventos." });
    }
};

// GET EVENT BY ID
const GetEventById = async (req, res) => {
    console.log('GetEventById 🚀');

    try {
        // 1. Extract params
        const { id } = req.params;

        // 2. Validate
        if (!id) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 3. Query with relations
        const event = await p.events.findFirst({
            where: {
                id: parseInt(id),
                situation: 1
            },
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true
            }
        });

        // 4. Check if found
        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 5. Return response
        return res.status(200).json({ event });

    } catch (error) {
        console.error("❌ Erro ao buscar evento:", error);
        return res.status(500).json({ message: "Erro ao buscar evento." });
    }
};

// GET MY COMPANY EVENTS
const GetMyCompanyEvents = async (req, res, page, pageSize) => {
    console.log('GetMyCompanyEvents 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Find user's company
        const userCompany = await p.companies.findFirst({
            where: {
                responsibleId: user.user.id,
                situation: 1
            }
        });

        if (!userCompany) {
            return res.status(403).json({
                message: "Você não é responsável de nenhuma empresa."
            });
        }

        // 3. Parse pagination params
        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        // 4. Build where clause
        const whereClause = {
            companyId: userCompany.id,
            situation: 1
        };

        // 5. Count total
        const total = await p.events.count({ where: whereClause });

        // 6. Query with pagination
        const events = await p.events.findMany({
            where: whereClause,
            include: {
                company: true,
                eventType: true
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit
        });

        // 7. Return response
        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            events
        });

    } catch (error) {
        console.error("❌ Erro ao buscar eventos da empresa:", error);
        return res.status(500).json({ message: "Erro ao buscar eventos da empresa." });
    }
};

// GET EVENTS BY COMPANY ID
const GetEventsByCompanyId = async (req, res, page, pageSize) => {
    console.log('GetEventsByCompanyId 🚀');

    try {
        // 1. Extract company ID
        const { companyId } = req.params;

        if (!companyId) {
            return res.status(400).json({ message: "ID da empresa é obrigatório." });
        }

        // 2. Check if company exists
        const company = await p.companies.findFirst({
            where: {
                id: parseInt(companyId),
                situation: 1
            }
        });

        if (!company) {
            return res.status(404).json({ message: "Empresa não encontrada." });
        }

        // 3. Parse pagination params
        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        // 4. Build where clause
        const whereClause = {
            companyId: parseInt(companyId),
            situation: 1
        };

        // 5. Count total
        const total = await p.events.count({ where: whereClause });

        // 6. Query with pagination
        const events = await p.events.findMany({
            where: whereClause,
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit
        });

        // 7. Return response
        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            events
        });

    } catch (error) {
        console.error("❌ Erro ao buscar eventos da empresa:", error);
        return res.status(500).json({ message: "Erro ao buscar eventos da empresa." });
    }
};

// GET PUBLIC ACTIVE EVENTS
const GetPublicEvents = async (req, res, page, pageSize) => {
    console.log('GetPublicEvents 🚀');

    try {
        // 1. Parse pagination params
        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        // 2. Build where clause
        const whereClause = {
            isPublic: true,
            situation: 1,
            endAt: {
                gte: new Date() // endAt must be greater than or equal to now (not passed yet)
            }
        };

        // 3. Count total
        const total = await p.events.count({ where: whereClause });

        // 4. Query with pagination
        const events = await p.events.findMany({
            where: whereClause,
            include: {
                company: {
                    include: {
                        responsible: {
                            include: { client: true }
                        }
                    }
                },
                eventType: true
            },
            orderBy: [
                { startAt: 'asc' }, // Order by start date (soonest first)
                { createdAt: 'desc' }
            ],
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit
        });

        // 5. Return response
        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            events
        });

    } catch (error) {
        console.error("❌ Erro ao buscar eventos públicos:", error);
        return res.status(500).json({ message: "Erro ao buscar eventos públicos." });
    }
};

module.exports = {
    CreateEvent,
    UpdateEvent,
    DeleteEvent,
    GetAllEvents,
    GetEventById,
    GetMyCompanyEvents,
    GetEventsByCompanyId,
    GetPublicEvents
};
