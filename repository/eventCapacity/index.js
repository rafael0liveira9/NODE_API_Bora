const p = require('../../lib/prisma');
const { jwtUncrypt } = require('../../utils/midleware/auth');

// ADD CAPACITY (DEPOSIT)
const AddCapacity = async (req, res) => {
    console.log('AddCapacity 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Extract and validate fields
        const { eventId, quantity, description } = req.body;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: "Quantidade deve ser maior que zero." });
        }

        // 3. Check if event exists
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

        // 4. Check if user is the company responsible
        if (event.company.responsibleId !== user.user.id) {
            return res.status(403).json({
                message: "Você não tem permissão para adicionar capacidade a este evento."
            });
        }

        // 5. Create deposit transaction
        const capacityTransaction = await p.eventCapacity.create({
            data: {
                eventId: parseInt(eventId),
                type: "deposit",
                quantity: parseInt(quantity),
                description: description || `Depósito de ${quantity} pessoas`,
                userId: user.user.id
            }
        });

        // 6. Calculate current capacity
        const currentCapacity = await calculateEventCapacity(parseInt(eventId));

        return res.status(201).json({
            message: `Depósito de ${quantity} pessoas realizado com sucesso!`,
            transaction: capacityTransaction,
            currentCapacity
        });

    } catch (error) {
        console.error("❌ Erro ao adicionar capacidade:", error);
        return res.status(500).json({ message: "Erro ao adicionar capacidade." });
    }
};

// REMOVE CAPACITY (WITHDRAWAL/CHECKIN)
const RemoveCapacity = async (req, res) => {
    console.log('RemoveCapacity 🚀');

    try {
        // 1. Auth check
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        // 2. Extract and validate fields
        const { eventId, quantity, description, clientId } = req.body;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: "Quantidade deve ser maior que zero." });
        }

        // 3. Check if event exists
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

        // 4. Check if user has permission (company responsible or checkin for yourself)
        const isCompanyResponsible = event.company.responsibleId === user.user.id;
        const isCheckingInSelf = clientId && parseInt(clientId) === user.user.clientId;

        if (!isCompanyResponsible && !isCheckingInSelf) {
            return res.status(403).json({
                message: "Você não tem permissão para remover capacidade deste evento."
            });
        }

        // 5. Check if there's enough capacity
        const currentCapacity = await calculateEventCapacity(parseInt(eventId));

        if (currentCapacity < parseInt(quantity)) {
            return res.status(400).json({
                message: `Capacidade insuficiente. Disponível: ${currentCapacity}, Solicitado: ${quantity}`
            });
        }

        // 6. Create withdrawal transaction
        const capacityTransaction = await p.eventCapacity.create({
            data: {
                eventId: parseInt(eventId),
                type: "withdrawal",
                quantity: parseInt(quantity),
                description: description || `Check-in de ${quantity} pessoa(s)`,
                userId: user.user.id,
                clientId: clientId ? parseInt(clientId) : null
            }
        });

        // 7. Calculate new capacity
        const newCapacity = await calculateEventCapacity(parseInt(eventId));

        return res.status(201).json({
            message: `Check-in de ${quantity} pessoa(s) realizado com sucesso!`,
            transaction: capacityTransaction,
            currentCapacity: newCapacity
        });

    } catch (error) {
        console.error("❌ Erro ao remover capacidade:", error);
        return res.status(500).json({ message: "Erro ao remover capacidade." });
    }
};

// GET EVENT CAPACITY
const GetEventCapacity = async (req, res) => {
    console.log('GetEventCapacity 🚀');

    try {
        // 1. Extract event ID
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 2. Check if event exists
        const event = await p.events.findFirst({
            where: {
                id: parseInt(eventId),
                situation: 1
            }
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 3. Calculate capacity
        const totalCapacity = await calculateEventCapacity(parseInt(eventId));

        // 4. Get capacity breakdown
        const deposits = await p.eventCapacity.aggregate({
            where: {
                eventId: parseInt(eventId),
                type: "deposit"
            },
            _sum: {
                quantity: true
            }
        });

        const withdrawals = await p.eventCapacity.aggregate({
            where: {
                eventId: parseInt(eventId),
                type: "withdrawal"
            },
            _sum: {
                quantity: true
            }
        });

        const totalDeposits = deposits._sum.quantity || 0;
        const totalWithdrawals = withdrawals._sum.quantity || 0;

        return res.status(200).json({
            eventId: parseInt(eventId),
            eventName: event.name,
            currentCapacity: totalCapacity,
            totalDeposits,
            totalWithdrawals,
            capacityUsed: totalWithdrawals,
            capacityRemaining: totalCapacity
        });

    } catch (error) {
        console.error("❌ Erro ao buscar capacidade do evento:", error);
        return res.status(500).json({ message: "Erro ao buscar capacidade do evento." });
    }
};

// GET EVENT CAPACITY HISTORY
const GetEventCapacityHistory = async (req, res, page, pageSize) => {
    console.log('GetEventCapacityHistory 🚀');

    try {
        // 1. Extract event ID
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({ message: "ID do evento é obrigatório." });
        }

        // 2. Check if event exists
        const event = await p.events.findFirst({
            where: {
                id: parseInt(eventId),
                situation: 1
            }
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado." });
        }

        // 3. Parse pagination params
        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 20;

        // 4. Build where clause
        const whereClause = {
            eventId: parseInt(eventId)
        };

        // 5. Count total
        const total = await p.eventCapacity.count({ where: whereClause });

        // 6. Query with pagination
        const transactions = await p.eventCapacity.findMany({
            where: whereClause,
            include: {
                user: {
                    include: {
                        client: true
                    }
                },
                client: true
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit
        });

        // 7. Calculate current capacity
        const currentCapacity = await calculateEventCapacity(parseInt(eventId));

        // 8. Return response
        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            currentCapacity,
            transactions
        });

    } catch (error) {
        console.error("❌ Erro ao buscar histórico de capacidade:", error);
        return res.status(500).json({ message: "Erro ao buscar histórico de capacidade." });
    }
};

// GET MY COMPANY EVENT CAPACITY SUMMARY
const GetMyCompanyEventCapacitySummary = async (req, res) => {
    console.log('GetMyCompanyEventCapacitySummary 🚀');

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

        // 3. Get all company events
        const events = await p.events.findMany({
            where: {
                companyId: userCompany.id,
                situation: 1
            },
            include: {
                eventCapacity: true
            }
        });

        // 4. Calculate capacity for each event
        const eventsSummary = await Promise.all(
            events.map(async (event) => {
                const capacity = await calculateEventCapacity(event.id);

                const deposits = await p.eventCapacity.aggregate({
                    where: {
                        eventId: event.id,
                        type: "deposit"
                    },
                    _sum: { quantity: true }
                });

                const withdrawals = await p.eventCapacity.aggregate({
                    where: {
                        eventId: event.id,
                        type: "withdrawal"
                    },
                    _sum: { quantity: true }
                });

                return {
                    eventId: event.id,
                    eventName: event.name,
                    startAt: event.startAt,
                    endAt: event.endAt,
                    currentCapacity: capacity,
                    totalDeposits: deposits._sum.quantity || 0,
                    totalWithdrawals: withdrawals._sum.quantity || 0
                };
            })
        );

        return res.status(200).json({
            company: {
                id: userCompany.id,
                name: userCompany.name
            },
            events: eventsSummary
        });

    } catch (error) {
        console.error("❌ Erro ao buscar resumo de capacidade:", error);
        return res.status(500).json({ message: "Erro ao buscar resumo de capacidade." });
    }
};

// HELPER FUNCTION: Calculate event capacity
async function calculateEventCapacity(eventId) {
    const deposits = await p.eventCapacity.aggregate({
        where: {
            eventId: eventId,
            type: "deposit"
        },
        _sum: {
            quantity: true
        }
    });

    const withdrawals = await p.eventCapacity.aggregate({
        where: {
            eventId: eventId,
            type: "withdrawal"
        },
        _sum: {
            quantity: true
        }
    });

    const totalDeposits = deposits._sum.quantity || 0;
    const totalWithdrawals = withdrawals._sum.quantity || 0;

    return totalDeposits - totalWithdrawals;
}

module.exports = {
    AddCapacity,
    RemoveCapacity,
    GetEventCapacity,
    GetEventCapacityHistory,
    GetMyCompanyEventCapacitySummary
};
